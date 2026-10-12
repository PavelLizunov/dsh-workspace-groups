import { z } from 'zod'
import { ACTIVITY_PROJECTION_KEY, applyActivityAt, readActivityAt } from './core/activity.ts'
import type { GroupsContext, GroupsSessionQueryContext } from './context-types.ts'

const activitySchema = z.number().int().nonnegative()
export const workspaceGroupsActivityProjectionDefinition = {
  key: ACTIVITY_PROJECTION_KEY,
  stateSchema: activitySchema,
  init: (header: { createdAt: number }): number => header.createdAt,
  apply: applyActivityAt,
  wire: { viewSchema: activitySchema, view: (state: number): number => state },
  stateVersion: 1,
}

/** Recover missing cold-list values through official observations, without resuming Agents. */
export function registerActivityRoute(ctx: GroupsContext): void {
  ctx.inject(['sessionQuery'], injected => {
    const query = (injected as GroupsSessionQueryContext).sessionQuery
    injected.effect(() => ctx.webServer.register({
      kind: 'exact',
      path: '/workspace-groups/activity',
      handler: async (req, res) => {
        const rejection = ctx.connection.requestRejection(req)
        if (rejection !== undefined) {
          res.writeHead(rejection)
          res.end(rejection === 401 ? 'unauthorized' : 'forbidden')
          return
        }
        if (req.method !== 'GET') {
          res.writeHead(405)
          res.end('method not allowed')
          return
        }
        const ids = new URL(req.url ?? '/', 'http://localhost').searchParams.getAll('id')
        if (ids.length === 0 || ids.length > 32 || ids.some(id => id.length === 0 || id.length > 200)) {
          res.writeHead(400)
          res.end('expected 1–32 session ids')
          return
        }
        const controller = new AbortController()
        const abort = () => { if (!res.writableEnded) controller.abort() }
        res.on('close', abort)
        try {
          const records = await query.listSessions(controller.signal)
          const visible = new Set(records.filter(record => record.header.cwd !== undefined && record.header.origin !== 'subagent').map(record => record.header.id as string))
          const activityAt: Record<string, number> = {}
          const unavailable: string[] = []
          for (const id of new Set(ids)) {
            if (!visible.has(id)) { unavailable.push(id); continue }
            try {
              const observation = await query.observeSession(id, { signal: controller.signal })
              try {
                const value = readActivityAt(observation.projections?.values)
                if (value === undefined) unavailable.push(id)
                else activityAt[id] = value
              } finally { observation[Symbol.dispose]() }
            } catch {
              controller.signal.throwIfAborted()
              unavailable.push(id)
            }
          }
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
          res.end(JSON.stringify({ activityAt, unavailable }))
        } catch {
          if (!controller.signal.aborted) {
            res.writeHead(503)
            res.end('session activity unavailable')
          }
        } finally { res.off('close', abort) }
      },
    }), 'workspace-groups: activity recovery route')
  })
}
