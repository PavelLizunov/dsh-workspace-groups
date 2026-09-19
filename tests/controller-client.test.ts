import { describe, expect, it, vi } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { SessionSummary, SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import type { WorkspaceView } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { GroupsBrowserInjected } from '../src/client/contract.ts'
vi.mock('@deepseek-ai/dsh-client-store', () => ({ defineStore: (value: unknown) => value }))
vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({}))
import { apply, inject } from '../src/client/index.ts'
import { deriveSearchGroups, deriveWorkspaceTree } from '../src/client/tree.ts'
import { indexSubagentDescendants } from '../src/client/subagent-lineage.ts'

const sid = (value: string) => value as SessionId
const summary = (id: string, extra: Partial<SessionSummary> = {}): SessionSummary => ({ id: sid(id), displayTitle: id, blank: false, running: false, updatedAt: 1, ...extra })

describe('DSH controller and static platform migration', () => {
  it('routes actions through their owning services and propagates errors', async () => {
    let actions!: GroupsBrowserInjected
    const disposers: (() => void)[] = []
    const disposed = vi.fn()
    const rename = vi.fn(async () => ({ ok: true }))
    const sessions = {
      search: vi.fn(async () => ({ ok: true, value: { items: [], hasMore: false } })),
      searchResultLimit: 50,
      open: vi.fn(), binding: vi.fn(() => ({ session: { rename } })), fork: vi.fn(async () => sid('child')),
    }
    const workspaces = {
      create: vi.fn(async () => ({ workspaceId: 'w' })), rename: vi.fn(), delete: vi.fn(),
      insertBefore: vi.fn(), insertSessionBefore: vi.fn(),
    }
    const uiWorkspace = {
      startSession: vi.fn(), archiveSession: vi.fn(), listDirectory: vi.fn(), createDirectory: vi.fn(),
    }
    const register = vi.fn((options: { inject: () => GroupsBrowserInjected }) => {
      actions = options.inject()
      return disposed
    })
    apply({
      sessions, workspaces, uiWorkspace,
      locale: { register: () => disposed },
      effect: (cb: () => () => void) => { disposers.push(cb()) },
      slots: { inject: (_name: string, cb: () => () => void) => { disposers.push(cb()) }, register },
    } as unknown as Context)
    expect(inject).toContain('uiWorkspace')
    expect(register.mock.calls[0]?.[0]).toMatchObject({ name: 'sidebar.workspaces', priority: -1 })
    expect(register.mock.calls[0]?.[0]).not.toHaveProperty('children')
    const w = 'w' as WorkspaceView['workspaceId']
    const s = sid('s')
    const signal = new AbortController().signal
    actions.startSession(w); actions.open(s)
    await actions.renameSession(s, 'new'); await actions.forkSession(s)
    await actions.renameWorkspace(w, 'new'); await actions.deleteWorkspace(w)
    await actions.insertWorkspaceBefore(w); await actions.insertSessionBefore(w, s)
    await actions.archiveSession(s); await actions.createWorkspace({ path: '/mock' })
    await actions.listDirectory('/mock', signal); await actions.createDirectory('/mock', 'child')
    await expect(actions.searchSessions('needle', signal)).resolves.toEqual({ items: [], hasMore: false })
    expect(sessions.search).toHaveBeenCalledWith('needle', signal)
    expect(rename).toHaveBeenCalledWith('new')
    expect(sessions.open).toHaveBeenLastCalledWith('child')
    expect(uiWorkspace.startSession).toHaveBeenCalledWith(w)
    expect(uiWorkspace.archiveSession).toHaveBeenCalledWith(s)
    expect(uiWorkspace.listDirectory).toHaveBeenCalledWith('/mock', signal)
    expect(uiWorkspace.createDirectory).toHaveBeenCalledWith('/mock', 'child')
    expect(workspaces.create).toHaveBeenCalledWith({ path: '/mock' })
    sessions.search.mockResolvedValueOnce({ ok: false, error: { message: 'search failed' } } as never)
    await expect(actions.searchSessions('needle', signal)).rejects.toThrow('search failed')
    rename.mockResolvedValueOnce({ ok: false, error: { message: 'rename failed' } } as never)
    await expect(actions.renameSession(s, 'no')).rejects.toThrow('rename failed')
    uiWorkspace.listDirectory.mockRejectedValueOnce(new Error('denied'))
    await expect(actions.listDirectory('/private', signal)).rejects.toThrow('denied')
    disposers.reverse().forEach(dispose => dispose())
    expect(disposed).toHaveBeenCalledTimes(2)
  })

  it.each(['eligible', 'running', 'pending', 'current', 'removed', 'archived', 'workspace-removed', 'moved-out', 'recent'] as const)('rechecks cleanup after a delayed archive: %s', async (change) => {
    const first = summary('first'), later = summary('later')
    let byId: Record<SessionId, SessionSummary> = { [first.id]: first, [later.id]: later }
    let current: SessionId | undefined
    let pending = new Map<SessionId, { key: string; kind: string; sessionId: SessionId }>()
    let archived: SessionId[] = []
    const workspaceId = 'w' as WorkspaceView['workspaceId']
    let items = [{ workspaceId, sessionIds: [first.id, later.id] }]
    let actions!: GroupsBrowserInjected
    let release!: () => void
    const paused = new Promise<void>(resolve => { release = resolve })
    const archive = vi.fn(async () => { await paused })
    apply({
      sessions: { list: { getSnapshot: () => ({ byId, current }) } },
      workspaces: { list: { getSnapshot: () => ({ items, archivedSessionIds: archived }) } },
      uiSession: { pendingInteractions: { getSnapshot: () => pending } },
      uiWorkspace: { archiveSession: archive },
      locale: { register: () => () => {} }, effect: (cb: () => () => void) => cb(),
      slots: { inject: (_key: string, cb: () => void) => cb(), register: (options: { inject: () => GroupsBrowserInjected }) => { actions = options.inject(); return () => {} } },
    } as unknown as Context)
    expect(inject).toContain('uiSession')
    const run = actions.cleanupSessions([first.id, later.id], 30, workspaceId)
    expect(archive).toHaveBeenCalledTimes(1)
    if (change === 'running') byId = { ...byId, [later.id]: { ...later, running: true } }
    if (change === 'pending') pending = new Map([[later.id, { key: 'q', kind: 'question', sessionId: later.id }]])
    if (change === 'current') current = later.id
    if (change === 'removed') byId = { [first.id]: first }
    if (change === 'archived') archived = [later.id]
    if (change === 'workspace-removed') items = []
    if (change === 'moved-out') items = [{ workspaceId, sessionIds: [first.id] }]
    if (change === 'recent') byId = { ...byId, [later.id]: { ...later, updatedAt: Date.now() } }
    release()
    await run
    expect(archive).toHaveBeenCalledTimes(change === 'eligible' ? 2 : 1)
    expect(archive).toHaveBeenCalledWith(first.id)
    items = []
    await actions.cleanupSessions([first.id], 30, workspaceId)
    expect(archive).toHaveBeenCalledTimes(change === 'eligible' ? 2 : 1)
  })

  it.each(['green', null])('keeps color %s and pending interaction independent in idle and search trees', (color) => {
    const s = summary('s')
    const list: SessionListState = { ids: [s.id], byId: { [s.id]: s }, current: undefined, phase: 'ready', jobsBySession: {}, subagentsByParent: {}, currentAddress: undefined }
    const workspace: WorkspaceView = { workspaceId: 'w' as never, title: 'W', path: '/mock', createdAt: '2026-01-01', updatedAt: '2026-01-01', sessionIds: [s.id] }
    const manual = { categories: [], assignments: {}, colors: { [s.id]: color } }
    const pending = new Map([[s.id, { key: 'approval-1', kind: 'approval', sessionId: s.id }]])
    const idle = deriveWorkspaceTree(list, [workspace], [], { categories: [] }, manual, pending)
    expect(idle.topLevel[0]?.attention).toBe('warning')
    expect(idle.counts.warning).toBe(1)
    expect(idle.topLevel[0]?.sessions[0]?.color).toBe(color ?? undefined)
    const search = deriveSearchGroups(list, [workspace], { categories: [] }, new Set([s.id]), [], manual, undefined, pending)
    expect(search.topLevel[0]?.sessions[0]?.pendingInteraction).toBe('approval')
    expect(search.topLevel[0]?.sessions[0]?.color).toBe(color ?? undefined)
    expect(deriveWorkspaceTree(list, [workspace], [], { categories: [] }, manual).counts.warning).toBe(0)
  })

  it('counts uninterrupted descendants and terminates on cycles or missing parents', () => {
    const root = summary('root')
    const child = summary('child', { origin: 'subagent', parentId: root.id })
    const nested = summary('nested', { origin: 'subagent', parentId: child.id, running: true })
    const fork = summary('fork', { parentId: root.id })
    const forkChild = summary('fork-child', { origin: 'subagent', parentId: fork.id, running: true })
    const byId = Object.fromEntries([root, child, nested, fork, forkChild].map(s => [s.id, s]))
    expect(indexSubagentDescendants(byId).get(root.id)).toEqual({ count: 2, runningCount: 1 })
    const cycle = summary('cycle', { origin: 'subagent', parentId: sid('cycle') })
    const orphan = summary('orphan', { origin: 'subagent', parentId: sid('missing') })
    expect(indexSubagentDescendants({ [cycle.id]: cycle, [orphan.id]: orphan }).size).toBe(2)
  })
})
