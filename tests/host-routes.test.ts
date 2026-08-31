/**
 * Tests for Host HTTP route contract and revision concurrency in src/index.ts.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { apply } from '../src/index.ts'
import type { GroupsContext, GroupsWebRoute, GroupsSettings } from '../src/context-types.ts'
import { DEFAULT_SIDEBAR_FILTER, type SidebarFilterPreferences } from '../src/core/types.ts'

describe('Host HTTP routes revision concurrency & unwrap compatibility', () => {
  let tempDir: string
  let originalDshHome: string | undefined
  let server: Server
  let baseUrl: string
  let settingsValue: SidebarFilterPreferences
  const routeHandlers = new Map<string, GroupsWebRoute['handler']>()

  function mount(settings?: GroupsSettings): void {
    const mockCtx = {
      effect: (cb: () => () => void) => cb(),
      inject: (_services: string[], callback: (ctx: unknown) => void) => {
        if (settings !== undefined) callback({ settings })
      },
      webServer: {
        register: (route: GroupsWebRoute) => {
          routeHandlers.set(route.path, route.handler)
          return () => routeHandlers.delete(route.path)
        },
      },
    } as unknown as GroupsContext
    apply(mockCtx)
  }

  beforeEach(async () => {
    routeHandlers.clear()
    originalDshHome = process.env.DSH_HOME
    tempDir = await mkdtemp(join(tmpdir(), 'wg-routes-test-'))
    process.env.DSH_HOME = tempDir
    settingsValue = { ...DEFAULT_SIDEBAR_FILTER }
    mount({
      register: () => undefined,
      get: () => settingsValue,
      update: async (_namespace, patch) => {
        settingsValue = { ...settingsValue, ...patch } as SidebarFilterPreferences
      },
    })

    server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://localhost')
      const handler = routeHandlers.get(url.pathname)
      if (handler) {
        handler(req, res)
      } else {
        res.statusCode = 404
        res.end()
      }
    })

    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const address = server.address() as AddressInfo
    baseUrl = `http://127.0.0.1:${address.port}`
  })

  afterEach(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()))
    if (originalDshHome === undefined) {
      delete process.env.DSH_HOME
    } else {
      process.env.DSH_HOME = originalDshHome
    }
    await rm(tempDir, { recursive: true, force: true })
  })

  it('GET /workspace-groups/config includes revision and ETag header', async () => {
    const res = await fetch(`${baseUrl}/workspace-groups/config`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('application/json')
    const etag = res.headers.get('etag')
    expect(etag).toMatch(/^W\/"[0-9a-f]{64}"$/)

    const data = await res.json()
    expect(data).toHaveProperty('categories')
    expect(data).toHaveProperty('manual')
    expect(data).toHaveProperty('revision')
    expect(data.revision).toMatch(/^[0-9a-f]{64}$/)
    expect(etag).toBe(`W/"${data.revision}"`)
  })

  it('HEAD /workspace-groups/config returns ETag header without body', async () => {
    const res = await fetch(`${baseUrl}/workspace-groups/config`, { method: 'HEAD' })
    expect(res.status).toBe(200)
    expect(res.headers.get('etag')).toMatch(/^W\/"[0-9a-f]{64}"$/)
    const text = await res.text()
    expect(text).toBe('')
  })

  it('accepts wrapped PUT { expectedRevision, manual } without resetting categories', async () => {
    const configRes = await fetch(`${baseUrl}/workspace-groups/config`)
    const configData = await configRes.json()
    const initialRevision = configData.revision

    const writeReq = {
      expectedRevision: initialRevision,
      manual: {
        categories: ['ProjectAlpha'],
        assignments: { 'ws-1': 'ProjectAlpha' },
      },
    }

    const putRes = await fetch(`${baseUrl}/workspace-groups/manual`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(writeReq),
    })

    expect(putRes.status).toBe(200)
    const putData = await putRes.json()
    expect(putData.ok).toBe(true)
    expect(putData.revision).toMatch(/^[0-9a-f]{64}$/)

    // Verify GET config reflects updated state
    const updatedConfigRes = await fetch(`${baseUrl}/workspace-groups/config`)
    const updatedData = await updatedConfigRes.json()
    expect(updatedData.manual.categories).toEqual(['ProjectAlpha'])
    expect(updatedData.manual.assignments).toEqual({ 'ws-1': 'ProjectAlpha' })
  })

  it('accepts unwrapped legacy PUT { categories, assignments } gracefully', async () => {
    const legacyBody = {
      categories: ['LegacyGroup'],
      assignments: { 'ws-2': 'LegacyGroup' },
    }
    const res = await fetch(`${baseUrl}/workspace-groups/manual`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(legacyBody),
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)

    const updatedConfigRes = await fetch(`${baseUrl}/workspace-groups/config`)
    const updatedData = await updatedConfigRes.json()
    expect(updatedData.manual.categories).toEqual(['LegacyGroup'])
    expect(updatedData.manual.assignments).toEqual({ 'ws-2': 'LegacyGroup' })
  })

  it('stale PUT returns 409 JSON { reason: "conflict", currentRevision }', async () => {
    const configRes = await fetch(`${baseUrl}/workspace-groups/config`)
    const configData = await configRes.json()

    const staleReq = {
      expectedRevision: 'stale-invalid-revision-hash',
      manual: {
        categories: ['StaleGroup'],
        assignments: {},
      },
    }

    const res = await fetch(`${baseUrl}/workspace-groups/manual`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(staleReq),
    })

    expect(res.status).toBe(409)
    expect(res.headers.get('content-type')).toContain('application/json')
    const conflictData = await res.json()
    expect(conflictData).toEqual({
      reason: 'conflict',
      currentRevision: configData.revision,
    })
  })

  it('rejects malformed or ambiguous PUT bodies without changing the overlay', async () => {
    const initial = await fetch(`${baseUrl}/workspace-groups/config`).then(res => res.json())
    const seedRes = await fetch(`${baseUrl}/workspace-groups/manual`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expectedRevision: initial.revision,
        manual: {
          categories: ['SeededCategory'],
          assignments: { 'ws-seed': 'SeededCategory' },
        },
      }),
    })
    const seeded = await seedRes.json()
    const explicitManual = { categories: ['BadGroup'], assignments: {} }
    const invalidBodies = [
      { expectedRevision: seeded.revision, manual: null },
      { expectedRevision: seeded.revision },
      { manual: explicitManual },
      { expectedRevision: 12345, manual: explicitManual },
      { expectedRevision: '', manual: explicitManual },
      { expectedRevision: '   ', manual: explicitManual },
      { expectedRevision: seeded.revision, manual: {} },
      {},
      { expectedRevision: seeded.revision, manual: explicitManual, categories: ['MixedGroup'] },
    ]

    for (const body of invalidBodies) {
      const res = await fetch(`${baseUrl}/workspace-groups/manual`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      expect(res.status).toBe(400)
    }

    const current = await fetch(`${baseUrl}/workspace-groups/config`).then(res => res.json())
    expect(current.manual.categories).toEqual(['SeededCategory'])
    expect(current.manual.assignments).toEqual({ 'ws-seed': 'SeededCategory' })
    expect(current.revision).toBe(seeded.revision)
  })

  it('persists profile filter preferences through GET and PUT', async () => {
    const initial = await fetch(`${baseUrl}/workspace-groups/preferences`).then(res => res.json())
    expect(initial).toEqual({ filter: DEFAULT_SIDEBAR_FILTER })

    const filter: SidebarFilterPreferences = { status: 'warning', recency: '7d', color: 'blue' }
    const put = await fetch(`${baseUrl}/workspace-groups/preferences`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filter }),
    })
    expect(put.status).toBe(200)
    expect(await put.json()).toEqual({ filter })
    expect(await fetch(`${baseUrl}/workspace-groups/preferences`).then(res => res.json())).toEqual({ filter })
  })

  it('rejects malformed filter preference writes', async () => {
    for (const body of [
      {},
      { filter: null },
      { filter: { status: 'bad', recency: 'all', color: null } },
      { filter: { ...DEFAULT_SIDEBAR_FILTER, extra: true } },
      { filter: DEFAULT_SIDEBAR_FILTER, extra: true },
    ]) {
      const res = await fetch(`${baseUrl}/workspace-groups/preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      expect(res.status).toBe(400)
    }
  })

  it('falls back to defaults when settings is unavailable and rejects writes', async () => {
    routeHandlers.clear()
    mount()
    const get = await fetch(`${baseUrl}/workspace-groups/preferences`)
    expect(get.status).toBe(200)
    expect(await get.json()).toEqual({ filter: DEFAULT_SIDEBAR_FILTER })
    const put = await fetch(`${baseUrl}/workspace-groups/preferences`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filter: DEFAULT_SIDEBAR_FILTER }),
    })
    expect(put.status).toBe(503)
  })

  it('yields exactly one 200 and one 409 for two simultaneous wrapped PUTs with same valid revision', async () => {
    const configRes = await fetch(`${baseUrl}/workspace-groups/config`)
    const configData = await configRes.json()
    const rev = configData.revision

    const req1 = fetch(`${baseUrl}/workspace-groups/manual`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expectedRevision: rev,
        manual: {
          categories: ['ConcurrentGroupA'],
          assignments: { 'ws-concurrent-1': 'ConcurrentGroupA' },
        },
      }),
    })

    const req2 = fetch(`${baseUrl}/workspace-groups/manual`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expectedRevision: rev,
        manual: {
          categories: ['ConcurrentGroupB'],
          assignments: { 'ws-concurrent-2': 'ConcurrentGroupB' },
        },
      }),
    })

    const [res1, res2] = await Promise.all([req1, req2])
    const statuses = [res1.status, res2.status].sort()
    expect(statuses).toEqual([200, 409])
  })
})
