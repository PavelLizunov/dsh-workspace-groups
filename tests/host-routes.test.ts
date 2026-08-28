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
import type { GroupsContext, GroupsWebRoute } from '../src/context-types.ts'

describe('Host HTTP routes revision concurrency & unwrap compatibility', () => {
  let tempDir: string
  let originalDshHome: string | undefined
  let server: Server
  let baseUrl: string
  const routeHandlers = new Map<string, GroupsWebRoute['handler']>()

  beforeEach(async () => {
    routeHandlers.clear()
    originalDshHome = process.env.DSH_HOME
    tempDir = await mkdtemp(join(tmpdir(), 'wg-routes-test-'))
    process.env.DSH_HOME = tempDir

    const mockCtx = {
      effect: (cb: () => () => void) => cb(),
      webServer: {
        register: (route: GroupsWebRoute) => {
          routeHandlers.set(route.path, route.handler)
          return () => routeHandlers.delete(route.path)
        },
      },
    } as unknown as GroupsContext

    apply(mockCtx)

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
})
