import { describe, expect, it, vi } from 'vitest'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { HostConnectionHandle } from '@deepseek-ai/dsh-client-connection'
import type { GroupsContext, GroupsWebRoute } from '../src/context-types.ts'

const io = vi.hoisted(() => ({
  readConfig: vi.fn(), readManual: vi.fn(), writeManual: vi.fn(), getSettings: vi.fn(), updateSettings: vi.fn(),
}))
vi.mock('../src/host-config.ts', () => ({ defaultConfigPath: () => '/test-only/config', readGroupsConfig: io.readConfig }))
vi.mock('../src/host-manual.ts', async (original) => ({
  ...await original<typeof import('../src/host-manual.ts')>(),
  defaultManualPath: () => '/test-only/manual', readManualEnvelope: io.readManual, writeManualGroupsIfRevision: io.writeManual,
}))
import { apply, inject } from '../src/index.ts'

type Gate = HostConnectionHandle['requestRejection']
function mount(requestRejection: Gate) {
  const routes = new Map<string, GroupsWebRoute['handler']>()
  const context = {
    connection: { requestRejection },
    effect: (cb: () => () => void) => cb(),
    inject: (services: string[], cb: (ctx: unknown) => void) => {
      if (services.includes('settings')) cb({
        settings: { register: () => ({ get: io.getSettings, update: io.updateSettings }) },
        effect: (effect: () => () => void) => effect(),
      })
    },
    webServer: { register: (route: GroupsWebRoute) => { routes.set(route.path, route.handler); return () => routes.delete(route.path) } },
  } as unknown as GroupsContext
  apply(context)
  return routes
}

async function call(handler: GroupsWebRoute['handler'], method: string) {
  let reads = 0
  const request = {
    method, headers: {},
    async *[Symbol.asyncIterator]() { reads++; yield Buffer.from('{}') },
  } as IncomingMessage
  const writeHead = vi.fn()
  const end = vi.fn()
  await handler(request, { writeHead, end } as unknown as ServerResponse)
  return { reads, request, writeHead, end }
}

const methods = [
  ['/workspace-groups/config', 'GET'], ['/workspace-groups/config', 'HEAD'],
  ['/workspace-groups/preferences', 'GET'], ['/workspace-groups/preferences', 'PUT'],
  ['/workspace-groups/manual', 'PUT'], ['/workspace-groups/manual', 'POST'],
] as const

describe('native request authentication boundary', () => {
  it.each([401, 403] as const)('rejects every route before body reads or data access (%s)', async (status) => {
    vi.clearAllMocks()
    const gate = vi.fn<Gate>(() => status)
    const routes = mount(gate)
    expect(inject).toContain('connection')
    for (const [path, method] of methods) {
      const result = await call(routes.get(path)!, method)
      expect(gate).toHaveBeenLastCalledWith(result.request)
      expect(result.writeHead).toHaveBeenCalledWith(status, { 'Content-Type': 'text/plain; charset=utf-8' })
      expect(result.end).toHaveBeenCalledWith(status === 401 ? 'unauthorized' : 'forbidden')
      expect(result.reads).toBe(0)
    }
    for (const fn of Object.values(io)) expect(fn).not.toHaveBeenCalled()
  })

  it('accepted requests retain normal method handling', async () => {
    const result = await call(mount(() => undefined).get('/workspace-groups/manual')!, 'POST')
    expect(result.writeHead).toHaveBeenCalledWith(405, expect.any(Object))
  })
})
