/**
 * dsh-workspace-groups host half: serves the sidecar grouping config to the
 * browser half over a single fenced GET route (`/workspace-groups/config`).
 *
 * The route is a read-only snapshot endpoint: the browser half fetches it on
 * load (and refetches on demand), the classification rules stay operator-
 * editable in the YAML file, and no core workspace.json / session storage is
 * touched. Static content — the config is small and operator-owned — uses
 * `Cache-Control: no-cache` so a page reload revalidates against the file
 * without the browser serving a stale grouping.
 */
import type { ServerResponse } from 'node:http'
import type { GroupsContext } from './context-types.ts'
import { defaultConfigPath, readGroupsConfig, type GroupsConfig } from './host-config.ts'

/** Plugin identity for cordis.yml rows. */
export const name = 'dsh-workspace-groups'

/** Services required before mounting: the webserver route. */
export const inject = ['webServer']

/** Write a plain-text error response with the given status. */
function writeError(res: ServerResponse, status: number, message: string): void {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' })
  res.end(message)
}

/** Plugin body: mount the config route. */
export function apply(ctx: GroupsContext): void {
  const configPath = defaultConfigPath()
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/workspace-groups/config',
    handler: async (req, res) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        writeError(res, 405, 'method not allowed')
        return
      }
      let config: GroupsConfig
      try {
        config = await readGroupsConfig(configPath)
      } catch (error) {
        writeError(res, 500, `workspace-groups: failed to read config: ${error instanceof Error ? error.message : String(error)}`)
        return
      }
      const body = JSON.stringify(config)
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Content-Length': Buffer.byteLength(body),
      })
      res.end(req.method === 'HEAD' ? undefined : body)
    },
  }), 'dsh-workspace-groups: /workspace-groups/config route')
}
