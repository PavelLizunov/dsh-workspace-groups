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
 *
 * Core workspace.json / session storage is never touched.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { GroupsContext } from './context-types.ts'
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

/** Plugin body: mount the config snapshot route and the overlay write route. */
export function apply(ctx: GroupsContext): void {
  const configPath = defaultConfigPath()
  const manualPath = defaultManualPath()

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
      let manual
      let expectedRevision: string | undefined
      try {
        if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
          const obj = raw as Record<string, unknown>
          if (typeof obj.expectedRevision === 'string') {
            expectedRevision = obj.expectedRevision
          }
        }
        manual = parseManualGroups(raw)
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
