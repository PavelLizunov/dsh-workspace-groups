/**
 * dsh-workspace-groups host half: serves the sidecar grouping config to the
 * browser half and persists the runtime grouping overlay.
 *
 * Routes:
 * - `GET /workspace-groups/config` — snapshot of the YAML rule categories
 *   merged with the runtime manual overlay (groups + assignments). Read-only
 *   for the rules; the overlay is attached so one fetch boots the browser.
 * - `PUT /workspace-groups/manual` — replace the whole manual overlay
 *   (manual groups + per-workspace overrides). Validated against the current
 *   rule categories, written atomically to the plugin-owned JSON sidecar.
 * - `GET/PUT /workspace-groups/preferences` — read/write profile-level filters
 *   through the optional official DSH settings service.
 *
 * Core workspace.json / session storage is never touched.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import Schema from '@deepseek-ai/schemastery'
import type { GroupsContext, GroupsSettingsContext } from './context-types.ts'
import {
  DEFAULT_SIDEBAR_FILTER,
  FILTER_COLOR_PRESETS,
  isSidebarFilterPreferences,
  parseSidebarFilterPreferences,
  type ManualGroups,
  type SidebarFilterPreferences,
} from './core/types.ts'
import { defaultConfigPath, readGroupsConfig } from './host-config.ts'
import {
  defaultManualPath,
  parseManualGroups,
  readManualEnvelope,
  readManualGroups,
  validateManualGroups,
  writeManualGroupsIfRevision,
} from './host-manual.ts'

/** Plugin identity for cordis.yml rows. */
export const name = 'dsh-workspace-groups'

/** Services required before mounting: the webserver route. */
export const inject = ['webServer']

/** Cap on the PUT body: the overlay is tiny; anything bigger is a client bug. */
const MAX_MANUAL_BODY_BYTES = 64 * 1024
const MAX_PREFERENCES_BODY_BYTES = 1024
const FILTER_SETTINGS_NAMESPACE = 'dsh-workspace-groups'
const FILTER_PREFERENCES_SCHEMA = Schema.object({
  status: Schema.union(['all', 'warning', 'ongoing', 'done'].map(value => Schema.const(value))).default('all'),
  recency: Schema.union(['all', '24h', '7d', '30d'].map(value => Schema.const(value))).default('all'),
  color: Schema.union([Schema.const(null), ...FILTER_COLOR_PRESETS.map(value => Schema.const(value))]).default(null),
})

/** Error with an HTTP status, mapped to a plain-text 4xx/5xx response. */
class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
  }
}

/** Write a plain-text error response with the given status. */
function writeError(res: ServerResponse, status: number, message: string): void {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' })
  res.end(message)
}

function writeJson(res: ServerResponse, status: number, value: unknown): void {
  const body = JSON.stringify(value)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
  })
  res.end(body)
}

/** Collect the request body as UTF-8 text, rejecting oversized bodies. */
async function readBody(req: IncomingMessage, limit: number): Promise<string> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > limit) throw new HttpError(413, 'request body too large')
    chunks.push(buffer)
  }
  if (chunks.length === 0) throw new HttpError(400, 'empty request body')
  return Buffer.concat(chunks).toString('utf8')
}

const MIXED_TOP_LEVEL_MANUAL_FIELDS = [
  'categories',
  'assignments',
  'categoryOrder',
  'workspaceOrder',
  'renamed',
  'hidden',
  'colors',
] as const

/** Strict fail-closed decoder for PUT /workspace-groups/manual payload. */
function decodeManualPutBody(raw: unknown): { manual: ManualGroups; expectedRevision?: string } {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('raw payload must be a non-array object mapping')
  }

  const obj = raw as Record<string, unknown>
  const hasManual = Object.hasOwn(obj, 'manual')
  const hasExpectedRevision = Object.hasOwn(obj, 'expectedRevision')

  if (hasManual || hasExpectedRevision) {
    if (!hasManual || !hasExpectedRevision) {
      throw new Error('wrapped mode requires both own "manual" and "expectedRevision" properties')
    }
    if (typeof obj.manual !== 'object' || obj.manual === null || Array.isArray(obj.manual)) {
      throw new Error('own property "manual" must be a non-null non-array object')
    }
    if (typeof obj.expectedRevision !== 'string' || obj.expectedRevision.trim() === '') {
      throw new Error('own property "expectedRevision" must be a non-empty string')
    }
    for (const field of MIXED_TOP_LEVEL_MANUAL_FIELDS) {
      if (Object.hasOwn(obj, field)) {
        throw new Error(`mixed top-level manual field "${field}" is rejected in wrapped mode`)
      }
    }
    const manual = obj.manual as Record<string, unknown>
    if (!Object.hasOwn(manual, 'categories') || !Object.hasOwn(manual, 'assignments')) {
      throw new Error('wrapped manual requires both own "categories" and "assignments" properties')
    }
    return { manual: parseManualGroups(manual), expectedRevision: obj.expectedRevision }
  }

  if (!Object.hasOwn(obj, 'categories') || !Object.hasOwn(obj, 'assignments')) {
    throw new Error('legacy flat mode requires both own "categories" and "assignments" properties')
  }

  return { manual: parseManualGroups(obj) }
}

function decodePreferencesPutBody(raw: unknown): SidebarFilterPreferences {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('payload must be an object containing "filter"')
  }
  const value = raw as Record<string, unknown>
  if (Object.keys(value).length !== 1 || !Object.hasOwn(value, 'filter') || !isSidebarFilterPreferences(value.filter)) {
    throw new Error('payload must contain one valid "filter" value')
  }
  return value.filter
}

/** Plugin body: mount the config snapshot route and persistence routes. */
export function apply(ctx: GroupsContext): void {
  const configPath = defaultConfigPath()
  const manualPath = defaultManualPath()

  let filterSettings: {
    get: () => SidebarFilterPreferences
    update: (filter: SidebarFilterPreferences) => Promise<SidebarFilterPreferences>
  } | undefined
  ctx.inject(['settings'], (injected) => {
    const settings = (injected as GroupsSettingsContext).settings
    settings.register(FILTER_SETTINGS_NAMESPACE, FILTER_PREFERENCES_SCHEMA, { applies: 'live' })
    filterSettings = {
      get: () => parseSidebarFilterPreferences(settings.get(FILTER_SETTINGS_NAMESPACE)),
      update: async (filter) => {
        await settings.update(FILTER_SETTINGS_NAMESPACE, filter)
        return parseSidebarFilterPreferences(settings.get(FILTER_SETTINGS_NAMESPACE))
      },
    }
  })

  let writeQueue = Promise.resolve()

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/workspace-groups/config',
    handler: async (req, res) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        writeError(res, 405, 'method not allowed')
        return
      }
      let config
      let envelope
      try {
        ;[config, envelope] = await Promise.all([
          readGroupsConfig(configPath),
          readManualEnvelope(manualPath),
        ])
      } catch (error) {
        writeError(res, 500, `workspace-groups: failed to read config: ${error instanceof Error ? error.message : String(error)}`)
        return
      }
      const body = JSON.stringify({ ...config, manual: envelope.manual, revision: envelope.revision })
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-cache',
        'ETag': `W/"${envelope.revision}"`,
        'Content-Length': Buffer.byteLength(body),
      })
      res.end(req.method === 'HEAD' ? undefined : body)
    },
  }), 'dsh-workspace-groups: /workspace-groups/config route')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/workspace-groups/preferences',
    handler: async (req, res) => {
      if (req.method === 'GET') {
        writeJson(res, 200, { filter: filterSettings?.get() ?? DEFAULT_SIDEBAR_FILTER })
        return
      }
      if (req.method !== 'PUT') {
        writeError(res, 405, 'method not allowed')
        return
      }
      if (filterSettings === undefined) {
        writeError(res, 503, 'workspace-groups: settings service unavailable')
        return
      }
      let filter: SidebarFilterPreferences
      try {
        filter = decodePreferencesPutBody(JSON.parse(await readBody(req, MAX_PREFERENCES_BODY_BYTES)))
      } catch (error) {
        const status = error instanceof HttpError ? error.status : 400
        writeError(res, status, `workspace-groups: ${error instanceof Error ? error.message : String(error)}`)
        return
      }
      try {
        writeJson(res, 200, { filter: await filterSettings.update(filter) })
      } catch (error) {
        writeError(res, 500, `workspace-groups: failed to write filter preferences: ${error instanceof Error ? error.message : String(error)}`)
      }
    },
  }), 'dsh-workspace-groups: /workspace-groups/preferences route')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/workspace-groups/manual',
    handler: async (req, res) => {
      if (req.method !== 'PUT') {
        writeError(res, 405, 'method not allowed')
        return
      }
      let raw: unknown
      try {
        raw = JSON.parse(await readBody(req, MAX_MANUAL_BODY_BYTES))
      } catch (error) {
        const status = error instanceof HttpError ? error.status : 400
        writeError(res, status, `workspace-groups: ${error instanceof Error ? error.message : String(error)}`)
        return
      }
      let manual: ManualGroups
      let expectedRevision: string | undefined
      try {
        const decoded = decodeManualPutBody(raw)
        manual = decoded.manual
        expectedRevision = decoded.expectedRevision
        // The write boundary knows the current rule set; reject assignments
        // into categories that exist nowhere (catches stale client state).
        const ruleConfig = (await readGroupsConfig(configPath)).categories
        validateManualGroups(manual, ruleConfig.map(category => category.name))
      } catch (error) {
        writeError(res, 400, `workspace-groups: ${error instanceof Error ? error.message : String(error)}`)
        return
      }

      let result
      try {
        const perform = async () => {
          if (expectedRevision !== undefined && expectedRevision !== '') {
            return writeManualGroupsIfRevision(manualPath, manual, expectedRevision)
          }
          // Legacy mode: unwrapped write without expectedRevision check
          const currentEnvelope = await readManualEnvelope(manualPath)
          const writeRes = await writeManualGroupsIfRevision(manualPath, manual, currentEnvelope.revision)
          return writeRes
        }
        const queued = writeQueue.then(perform, perform)
        writeQueue = queued.then(() => undefined, () => undefined)
        result = await queued
      } catch (error) {
        writeError(res, 500, `workspace-groups: failed to write manual overlay: ${error instanceof Error ? error.message : String(error)}`)
        return
      }

      if (!result.ok) {
        const body = JSON.stringify({ reason: 'conflict', currentRevision: result.currentRevision })
        res.writeHead(409, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
          'ETag': `W/"${result.currentRevision}"`,
          'Content-Length': Buffer.byteLength(body),
        })
        res.end(body)
        return
      }

      const body = JSON.stringify({ ok: true, revision: result.revision })
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'ETag': `W/"${result.revision}"`,
        'Content-Length': Buffer.byteLength(body),
      })
      res.end(body)
    },
  }), 'dsh-workspace-groups: /workspace-groups/manual route')
}
