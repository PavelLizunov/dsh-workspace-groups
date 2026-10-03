/**
 * Tree-derivation tests: the renderer's data-shaping contract — manual
 * overrides win over rules, manual groups render while empty, rule buckets
 * hide while empty, and top-level (ungrouped) workspaces render as separate
 * rows after the group folders (no "uncategorized" bucket).
 * Pure derivation (no DOM), fixtures cast to the runtime contract types.
 *
 * The lineage helper is mocked here to count canonical derivations;
 * controller-client.test.ts exercises its real descendant traversal.
 */
import { describe, expect, it, vi } from 'vitest'

const runtimeMocks = vi.hoisted(() => ({
  indexSubagentDescendants: vi.fn(() => new Map()),
}))
vi.mock('../src/client/subagent-lineage.ts', () => runtimeMocks)

import type { SessionListState, SessionSummary } from '@deepseek-ai/dsh-api-session-controller/client'
import type { WorkspaceView } from '@deepseek-ai/dsh-api-workspace-controller/client'
import { deriveCompletionObservations, deriveGroups, deriveSearchGroups, deriveTopLevel, deriveWorkspaceTree, projectTreeExpansion, sessionAttention, workspaceLabel } from '../src/client/tree.ts'
import { ATTENTION_PROJECTION_KEY } from '../src/core/attention.ts'
import type { GroupsConfig, ManualGroups } from '../src/core/types.ts'
import { acknowledgeSessionErrorImpl, reconcileSessionCompletionImpl, type GroupsViewState } from '../src/client/store-core.ts'
import { applySidebarFilter, DEFAULT_SIDEBAR_FILTER } from '../src/client/tree-filter.ts'

const CONFIG: GroupsConfig = {
  categories: [
    { name: 'DSH Plugins', rules: [{ nameContains: 'Plugin' }] },
    { name: 'Docs', rules: [{ basenameContains: 'docs' }] },
  ],
}

function workspace(id: string, path: string, title: string, sessionIds: string[] = []): WorkspaceView {
  return { workspaceId: id, path, title, createdAt: '2026-01-01T00:00:00.000Z', sessionIds } as unknown as WorkspaceView
}

function session(id: string, title: string): SessionSummary {
  return {
    id,
    origin: 'user',
    blank: false,
    displayTitle: title,
    running: false,
    completed: false,
    updatedAt: 1_700_000_000_000,
    cwd: '/Users/zcol/Project/x',
  } as unknown as SessionSummary
}

function listState(workspaces: WorkspaceView[], current?: string): SessionListState {
  const byId: Record<string, SessionSummary> = {}
  for (const ws of workspaces) {
    for (const id of ws.sessionIds) byId[id] = session(id, `session-${id}`)
  }
  return {
    ids: Object.keys(byId),
    byId,
    current,
    phase: 'ready',
    subagentsByParent: {},
  } as unknown as SessionListState
}

const VIEW = { expandedCategories: [], expandedWorkspaces: [] }

it.each(['error', 'interrupted', 'max-tokens'] as const)('preserves restored selected %s attention in normal and search trees', (reason) => {
  const workspaces = [workspace('ws-a', '/tmp/Plugin', 'Plugin', ['s1'])]
  const list = listState(workspaces, 's1')
  list.byId[list.ids[0]!] = { ...list.byId[list.ids[0]!]!, completed: true, projectionValues: { [ATTENTION_PROJECTION_KEY]: { reason } } } as SessionSummary
  const manual = { categories: [], assignments: {} }
  const tree = deriveWorkspaceTree(list, workspaces, [], CONFIG, manual, new Map(), { s1: true })
  expect(tree.categories[0]?.attention).toBe('error')
  expect(tree.counts).toEqual({ all: 1, warning: 1, ongoing: 0, done: 0 })
  const search = deriveSearchGroups(list, workspaces, CONFIG, new Set(list.ids), [], manual)
  expect(sessionAttention(search.categories[0]!.workspaces[0]!.sessions[0]!)).toBe('error')
})

it('intersects group/workspace scopes with search results and top-level branches', () => {
  const workspaces = [
    workspace('w1', '/tmp/Plugin', 'Plugin', ['s1']),
    workspace('w2', '/tmp/docs', 'Docs', ['s2']),
    workspace('w3', '/tmp/other', 'Other', ['s3']),
  ]
  const list = listState(workspaces)
  const search = deriveSearchGroups(list, workspaces, CONFIG, new Set(list.ids), [], { categories: [], assignments: {} })
  const selected = applySidebarFilter(search.categories, search.topLevel, { ...DEFAULT_SIDEBAR_FILTER, groupKey: 'DSH Plugins', workspaceId: 'w1' }, {}, Date.now())
  expect(selected.categories.map(category => category.key)).toEqual(['DSH Plugins'])
  expect(selected.categories[0]?.workspaces[0]?.sessions.map(session => session.id)).toEqual(['s1'])
  expect(selected.topLevel).toEqual([])
  expect(selected.counts.all).toBe(1)
  const incompatible = applySidebarFilter(search.categories, search.topLevel, { ...DEFAULT_SIDEBAR_FILTER, groupKey: 'DSH Plugins', workspaceId: 'w2' }, {}, Date.now())
  expect(incompatible.counts.all).toBe(0)
  const ungrouped = applySidebarFilter(search.categories, search.topLevel, { ...DEFAULT_SIDEBAR_FILTER, groupKey: '__topLevel__' }, {}, Date.now())
  expect(ungrouped.categories).toEqual([])
  expect(ungrouped.topLevel.map(workspace => workspace.workspaceId)).toEqual(['w3'])
})

describe('viewed error attention', () => {
  it.each(['error', 'interrupted', 'max-tokens'] as const)('persists acknowledgment of %s and shows a newer error', (reason) => {
    const workspaces = [workspace('ws-a', '/tmp/Plugin', 'Plugin', ['s1', 's2'])]
    let list = listState(workspaces)
    list.byId[list.ids[0]!] = { ...list.byId[list.ids[0]!]!, completed: true, projectionValues: { [ATTENTION_PROJECTION_KEY]: { reason } } } as SessionSummary
    const manual = { categories: [], assignments: {} }
    let view: GroupsViewState = { categoryExpansion: {}, workspaceExpansion: {} }
    const derive = () => deriveWorkspaceTree(list, workspaces, [], CONFIG, manual, new Map(), view.completedSessions, view.acknowledgedErrors)
    expect(derive().counts.warning).toBe(1)
    list = { ...list, current: 's1' as never }
    acknowledgeSessionErrorImpl(view, 's1', `${list.byId[list.ids[0]!]!.updatedAt}:${reason}`)
    reconcileSessionCompletionImpl(view, deriveCompletionObservations(list, []), list.current)
    view = JSON.parse(JSON.stringify(view)) as GroupsViewState
    list = { ...list, current: 's2' as never }
    reconcileSessionCompletionImpl(view, deriveCompletionObservations(list, []), list.current)
    const tree = derive()
    expect(tree.counts).toEqual({ all: 2, warning: 0, ongoing: 0, done: 0 })
    expect(projectTreeExpansion(tree, VIEW).categories[0]?.attention).toBeUndefined()
    const search = deriveSearchGroups(list, workspaces, CONFIG, new Set(list.ids), [], manual, undefined, new Map(), view.completedSessions, view.acknowledgedErrors)
    const filtered = applySidebarFilter(search.categories, search.topLevel, { ...DEFAULT_SIDEBAR_FILTER, status: 'warning' }, {}, Date.now())
    expect(filtered.counts.warning).toBe(0)
    expect(filtered.categories).toEqual([])
    const retained = applySidebarFilter(search.categories, search.topLevel, { ...DEFAULT_SIDEBAR_FILTER, status: 'warning' }, {}, Date.now(), new Set(['s1']))
    expect(retained.categories[0]?.workspaces[0]?.sessions.map(s => s.id)).toEqual(['s1'])
    expect(retained.counts.warning).toBe(0)
    expect(deriveCompletionObservations(list, [list.ids[0]!]).map(s => s.id)).toEqual(['s2'])
    list = { ...list, current: 's1' as never }
    list.byId[list.ids[0]!] = { ...list.byId[list.ids[0]!]!, updatedAt: list.byId[list.ids[0]!]!.updatedAt + 1 }
    expect(derive().counts.warning).toBe(1)
    reconcileSessionCompletionImpl(view, deriveCompletionObservations(list, []), list.current)
    expect(view.acknowledgedErrors).toEqual({})
    expect(derive().counts.warning).toBe(1)
  })

  it('keeps real pending interactions and SDD requests after viewing', () => {
    const workspaces = [workspace('ws-a', '/tmp/Plugin', 'Plugin', ['s1'])]
    const list = listState(workspaces, 's1')
    const manual = { categories: [], assignments: {} }
    for (const reason of ['error', 'awaiting-user'] as const) {
      list.byId[list.ids[0]!] = { ...list.byId[list.ids[0]!]!, projectionValues: { [ATTENTION_PROJECTION_KEY]: { reason } } } as SessionSummary
      for (const kind of ['approval', 'question', 'plan-review'] as const) {
        const pending = new Map([[list.ids[0]!, { kind }]]) as never
        expect(deriveWorkspaceTree(list, workspaces, [], CONFIG, manual, pending).counts.warning).toBe(1)
      }
    }
    expect(deriveWorkspaceTree(list, workspaces, [], CONFIG, manual).counts.warning).toBe(1)
  })
})

describe('workspaceLabel', () => {
  it('uses an English fallback when cwd is missing', () => {
    expect(workspaceLabel(undefined)).toBe('Unknown workspace')
    expect(workspaceLabel('')).toBe('Unknown workspace')
  })
})

describe('deriveGroups with the manual overlay', () => {
  const workspaces = [
    workspace('ws-a', '/Users/zcol/Project/SomePlugin', 'DSH Plugin Demo'),
    workspace('ws-b', '/Users/zcol/Project/MyDocs', 'MyDocs'),
    workspace('ws-c', '/tmp/random', 'Random'),
  ]

  it('groups by rules without an overlay; unmatched workspaces are top-level', () => {
    const groups = deriveGroups(listState(workspaces), workspaces, [], CONFIG, VIEW, { categories: [], assignments: {} })
    const labels = groups.map(g => g.label)
    expect(labels).toEqual(['DSH Plugins', 'Docs'])
    expect(groups[0]?.workspaces.map(w => w.workspaceId)).toEqual(['ws-a'])
    expect(groups[1]?.workspaces.map(w => w.workspaceId)).toEqual(['ws-b'])
    // ws-c matches no rule → top-level, not in any bucket.
    const top = deriveTopLevel(listState(workspaces), workspaces, [], CONFIG, VIEW, { categories: [], assignments: {} })
    expect(top.map(w => w.workspaceId)).toEqual(['ws-c'])
  })

  it('a manual override moves a workspace into a manual group', () => {
    const manual: ManualGroups = { categories: ['Temp'], assignments: { 'ws-a': 'Temp' } }
    const groups = deriveGroups(listState(workspaces), workspaces, [], CONFIG, VIEW, manual)
    const byLabel = new Map(groups.map(g => [g.label, g]))
    expect(byLabel.get('Temp')?.workspaces.map(w => w.workspaceId)).toEqual(['ws-a'])
    // ws-a left the rule bucket; with nothing left, the empty rule bucket hides.
    expect(byLabel.has('DSH Plugins')).toBe(false)
    expect(byLabel.get('Docs')?.workspaces.map(w => w.workspaceId)).toEqual(['ws-b'])
  })

  it('an empty manual group still renders (a new group appears before any drop)', () => {
    const manual: ManualGroups = { categories: ['Temp'], assignments: {} }
    const groups = deriveGroups(listState(workspaces), workspaces, [], CONFIG, VIEW, manual)
    const byLabel = new Map(groups.map(g => [g.label, g]))
    expect(byLabel.has('Temp')).toBe(true)
    expect(byLabel.get('Temp')?.workspaces).toEqual([])
  })

  it('an empty rule bucket stays hidden', () => {
    const manual: ManualGroups = { categories: [], assignments: {} }
    const groups = deriveGroups(listState([]), [], [], CONFIG, VIEW, manual)
    expect(groups).toEqual([])
  })

  it('removing an override reverts to rule classification', () => {
    // ws-a overridden to Temp; override removed → rule classification applies again.
    const withOverride: ManualGroups = { categories: ['Temp'], assignments: { 'ws-a': 'Temp' } }
    const moved = deriveGroups(listState(workspaces), workspaces, [], CONFIG, VIEW, withOverride)
    expect(moved.find(g => g.label === 'Temp')?.workspaces).toHaveLength(1)

    const reverted: ManualGroups = { categories: ['Temp'], assignments: {} }
    const back = deriveGroups(listState(workspaces), workspaces, [], CONFIG, VIEW, reverted)
    expect(back.find(g => g.label === 'Temp')?.workspaces).toHaveLength(0)
    expect(back.find(g => g.label === 'DSH Plugins')?.workspaces.map(w => w.workspaceId)).toEqual(['ws-a'])
  })

  it('a null override forces top-level (rule match ignored)', () => {
    const manual: ManualGroups = { categories: [], assignments: { 'ws-a': null } }
    const groups = deriveGroups(listState(workspaces), workspaces, [], CONFIG, VIEW, manual)
    expect(groups.find(g => g.label === 'DSH Plugins')).toBeUndefined()
    const top = deriveTopLevel(listState(workspaces), workspaces, [], CONFIG, VIEW, manual)
    // ws-a forced top-level; ws-c matches no rule and is top-level too.
    expect(top.map(w => w.workspaceId)).toEqual(['ws-a', 'ws-c'])
  })

  it('stored workspace order wins inside a bucket', () => {
    const manual: ManualGroups = {
      categories: [],
      assignments: {},
      workspaceOrder: { 'DSH Plugins': ['ws-a2', 'ws-a1'] },
    }
    const ws = [
      workspace('ws-a1', '/Users/zcol/Project/AA', 'Plugin A1'),
      workspace('ws-a2', '/Users/zcol/Project/BB', 'Plugin A2'),
    ]
    const groups = deriveGroups(listState(ws), ws, [], CONFIG, VIEW, manual)
    expect(groups.find(g => g.label === 'DSH Plugins')?.workspaces.map(w => w.workspaceId)).toEqual(['ws-a2', 'ws-a1'])
  })

  it('a renamed rule category renders under the new name', () => {
    const manual: ManualGroups = { categories: [], assignments: {}, renamed: { 'DSH Plugins': 'Plugin Suite' } }
    const groups = deriveGroups(listState(workspaces), workspaces, [], CONFIG, VIEW, manual)
    const byLabel = new Map(groups.map(g => [g.label, g]))
    expect(byLabel.has('Plugin Suite')).toBe(true)
    expect(byLabel.get('Plugin Suite')?.workspaces.map(w => w.workspaceId)).toEqual(['ws-a'])
    expect(byLabel.has('DSH Plugins')).toBe(false)
  })

  it('a hidden rule category is inert — its members become top-level', () => {
    const manual: ManualGroups = { categories: [], assignments: {}, hidden: ['DSH Plugins'] }
    const groups = deriveGroups(listState(workspaces), workspaces, [], CONFIG, VIEW, manual)
    expect(groups.find(g => g.label === 'DSH Plugins')).toBeUndefined()
    const top = deriveTopLevel(listState(workspaces), workspaces, [], CONFIG, VIEW, manual)
    expect(top.map(w => w.workspaceId)).toEqual(['ws-a', 'ws-c'])
  })
})

describe('deriveTopLevel', () => {
  const ws = [
    workspace('ws-a', '/Users/zcol/Project/SomePlugin', 'DSH Plugin Demo'),
    workspace('ws-b', '/Users/zcol/Project/MyDocs', 'MyDocs'),
    workspace('ws-c', '/tmp/random', 'Random'),
  ]

  it('keeps host order for ungrouped workspaces', () => {
    const manual: ManualGroups = { categories: [], assignments: { 'ws-a': null, 'ws-b': 'Docs' } }
    const top = deriveTopLevel(listState(ws), ws, [], CONFIG, VIEW, manual)
    // ws-a (forced) and ws-c (rule-less), in host order; ws-b grouped.
    expect(top.map(w => w.workspaceId)).toEqual(['ws-a', 'ws-c'])
  })

  it('top-level rows are expanded according to the view', () => {
    const wsC = workspace('ws-c', '/tmp/random', 'Random', ['s1'])
    const view = { expandedCategories: [], expandedWorkspaces: ['ws-c'] }
    const top = deriveTopLevel(listState([wsC]), [wsC], [], CONFIG, view, { categories: [], assignments: {} })
    expect(top[0]?.expanded).toBe(true)
    expect(top[0]?.sessions).toHaveLength(1)
    expect(top[0]?.sessions[0]?.id).toBe('s1')
    // Collapsed view → no sessions.
    const collapsed = deriveTopLevel(listState([wsC]), [wsC], [], CONFIG, VIEW, { categories: [], assignments: {} })
    expect(collapsed[0]?.expanded).toBe(false)
    expect(collapsed[0]?.sessions).toEqual([])
  })

  it('top-level rows honor the manual order (workspaceOrder[__topLevel__])', () => {
    const manual: ManualGroups = {
      categories: [], assignments: { 'ws-a': null, 'ws-b': null, 'ws-c': null },
      workspaceOrder: { __topLevel__: ['ws-c', 'ws-a', 'ws-b'] },
    }
    const top = deriveTopLevel(listState(ws), ws, [], CONFIG, VIEW, manual)
    expect(top.map(w => w.workspaceId)).toEqual(['ws-c', 'ws-a', 'ws-b'])
  })
})

describe('aggregated attention state derivation', () => {
  function sessionWithState(
    id: string,
    opts: { running?: boolean; completed?: boolean; pendingInteraction?: 'approval' | 'plan-review' | 'question' },
  ): SessionSummary {
    return {
      id,
      origin: 'user',
      blank: false,
      displayTitle: `session-${id}`,
      running: opts.running ?? false,
      completed: opts.completed ?? false,
      updatedAt: 1_700_000_000_000,
      cwd: '/Users/zcol/Project/x',
      ...(opts.pendingInteraction ? { pendingInteraction: opts.pendingInteraction } : {}),
    } as unknown as SessionSummary
  }

  function customListState(byId: Record<string, SessionSummary>): SessionListState {
    return {
      ids: Object.keys(byId),
      byId,
      current: undefined,
      phase: 'ready',
      subagentsByParent: {},
    } as unknown as SessionListState
  }

  it('computes workspace and category attention respecting priority warning > ongoing > done', () => {
    const ws1 = workspace('ws-1', '/Users/zcol/Project/SomePlugin', 'DSH Plugin', ['s1', 's2'])
    const ws2 = workspace('ws-2', '/Users/zcol/Project/SomePlugin2', 'Other Plugin', ['s3'])
    const sessions = {
      s1: sessionWithState('s1', { completed: true }),
      s2: sessionWithState('s2', { running: true }),
      s3: sessionWithState('s3', { pendingInteraction: 'approval' }),
    }
    const list = customListState(sessions)
    const groups = deriveGroups(list, [ws1, ws2], [], CONFIG, VIEW, { categories: [], assignments: {} }, new Map([[sessions.s3.id, { key: 'q', kind: 'approval', sessionId: sessions.s3.id }]]))
    const cat = groups.find(g => g.label === 'DSH Plugins')!
    expect(cat.attention).toBe('warning')
    expect(cat.workspaces.find(w => w.workspaceId === 'ws-1')?.attention).toBe('ongoing')
    expect(cat.workspaces.find(w => w.workspaceId === 'ws-2')?.attention).toBe('warning')
  })

  it('computes attention from all visible sessions even when Workspace and Category are collapsed', () => {
    const ws1 = workspace('ws-1', '/Users/zcol/Project/SomePlugin', 'DSH Plugin', ['s1'])
    const sessions = {
      s1: sessionWithState('s1', { completed: true }),
    }
    const list = customListState(sessions)
    const collapsedView = { expandedCategories: [], expandedWorkspaces: [] }
    const groups = deriveGroups(list, [ws1], [], CONFIG, collapsedView, { categories: [], assignments: {} })
    const cat = groups.find(g => g.label === 'DSH Plugins')!
    const wsNode = cat.workspaces[0]!

    expect(cat.expanded).toBe(false)
    expect(wsNode.expanded).toBe(false)
    expect(wsNode.sessions).toEqual([])
    expect(wsNode.sessionCount).toBe(1)
    expect(wsNode.attention).toBe('done')
    expect(cat.attention).toBe('done')
  })

  it('returns undefined attention when no child sessions have attention state', () => {
    const ws1 = workspace('ws-1', '/Users/zcol/Project/SomePlugin', 'DSH Plugin', ['s1'])
    const sessions = {
      s1: sessionWithState('s1', {}),
    }
    const list = customListState(sessions)
    const groups = deriveGroups(list, [ws1], [], CONFIG, VIEW, { categories: [], assignments: {} })
    const cat = groups.find(g => g.label === 'DSH Plugins')!
    expect(cat.attention).toBeUndefined()
    expect(cat.workspaces[0]?.attention).toBeUndefined()
  })

  it('computes attention for top-level workspaces', () => {
    const ws = workspace('ws-top', '/tmp/random', 'Random', ['s1'])
    const sessions = {
      s1: sessionWithState('s1', { running: true }),
    }
    const list = customListState(sessions)
    const top = deriveTopLevel(list, [ws], [], CONFIG, VIEW, { categories: [], assignments: {} })
    expect(top[0]?.attention).toBe('ongoing')
  })

  it('derives one canonical tree and projects expansion without rescanning sessions', () => {
    const grouped = workspace('ws-grouped', '/src/SomePlugin', 'Grouped Plugin', ['s1'])
    const top = workspace('ws-top', '/tmp/random', 'Random', ['s2'])
    const list = customListState({
      s1: sessionWithState('s1', { running: true }),
      s2: sessionWithState('s2', { completed: true }),
    })
    runtimeMocks.indexSubagentDescendants.mockClear()

    const canonical = deriveWorkspaceTree(list, [grouped, top], [], CONFIG, { categories: [], assignments: {} })
    expect(runtimeMocks.indexSubagentDescendants).toHaveBeenCalledTimes(1)
    expect(canonical.categories[0]?.workspaces[0]?.sessions).toHaveLength(1)
    expect(canonical.topLevel[0]?.sessions).toHaveLength(1)
    expect(canonical.counts).toEqual({ all: 2, warning: 0, ongoing: 1, done: 1 })

    const projected = projectTreeExpansion(canonical, {
      expandedCategories: ['DSH Plugins'],
      expandedWorkspaces: ['ws-grouped'],
    })
    expect(runtimeMocks.indexSubagentDescendants).toHaveBeenCalledTimes(1)
    expect(projected.categories[0]?.expanded).toBe(true)
    expect(projected.categories[0]?.workspaces[0]?.sessions[0]).toBe(canonical.categories[0]?.workspaces[0]?.sessions[0])
    expect(projected.topLevel[0]?.expanded).toBe(false)
    expect(projected.topLevel[0]?.sessions).toEqual([])
  })

  it('maps projection reason from SessionSummary to SessionNode without extra scans', () => {
    const ws1 = workspace('ws-1', '/Users/zcol/Project/SomePlugin', 'DSH Plugin', ['s1', 's2', 's3'])
    const s1 = {
      ...session('s1', 's1'),
      projectionValues: { [ATTENTION_PROJECTION_KEY]: { reason: 'error' } },
    } as unknown as SessionSummary
    const s2 = {
      ...session('s2', 's2'),
      projectionValues: { [ATTENTION_PROJECTION_KEY]: { reason: 'awaiting-user' } },
    } as unknown as SessionSummary
    const s3 = session('s3', 's3')
    const list = customListState({ s1, s2, s3 })

    const canonical = deriveWorkspaceTree(list, [ws1], [], CONFIG, { categories: [], assignments: {} })
    const sessions = canonical.categories[0]!.workspaces[0]!.sessions
    expect(sessions[0]?.projectionReason).toBe('error')
    expect(sessions[1]?.projectionReason).toBe('awaiting-user')
    expect(sessions[2]?.projectionReason).toBeUndefined()
  })

  it('evaluates sessionAttention priority: error > warning > ongoing > done', () => {
    expect(sessionAttention({ running: false, runningSubagentCount: 0, completed: false, projectionReason: 'error' })).toBe('error')
    expect(sessionAttention({ running: false, runningSubagentCount: 0, completed: false, projectionReason: 'interrupted' })).toBe('error')
    expect(sessionAttention({ running: false, runningSubagentCount: 0, completed: false, projectionReason: 'max-tokens' })).toBe('error')
    expect(sessionAttention({ pendingInteraction: 'question', running: false, runningSubagentCount: 0, completed: false, projectionReason: 'error' })).toBe('error')
    expect(sessionAttention({ pendingInteraction: 'question', running: false, runningSubagentCount: 0, completed: false, projectionReason: 'awaiting-user' })).toBe('warning')
    expect(sessionAttention({ running: false, runningSubagentCount: 0, completed: false, projectionReason: 'awaiting-user' })).toBe('warning')
    expect(sessionAttention({ running: true, runningSubagentCount: 0, completed: false, projectionReason: 'awaiting-user' })).toBe('warning')
    expect(sessionAttention({ running: true, runningSubagentCount: 0, completed: false, projectionReason: 'error' })).toBe('error')
  })

  it('aggregates category and workspace attention prioritizing error > warning > ongoing > done and counts error as warning in totals', () => {
    const ws1 = workspace('ws-1', '/Users/zcol/Project/SomePlugin', 'DSH Plugin', ['s1', 's2'])
    const ws2 = workspace('ws-2', '/Users/zcol/Project/SomePlugin2', 'Other Plugin', ['s3'])
    const s1 = {
      ...session('s1', 's1'),
      projectionValues: { [ATTENTION_PROJECTION_KEY]: { reason: 'error' } },
    } as unknown as SessionSummary
    const s2 = sessionWithState('s2', { pendingInteraction: 'approval' })
    const s3 = sessionWithState('s3', { running: true })
    const list = customListState({ s1, s2, s3 })

    const canonical = deriveWorkspaceTree(list, [ws1, ws2], [], CONFIG, { categories: [], assignments: {} }, new Map([[s2.id, { key: 'q', kind: 'approval', sessionId: s2.id }]]))
    const cat = canonical.categories.find(g => g.label === 'DSH Plugins')!
    expect(cat.attention).toBe('error')
    expect(cat.workspaces.find(w => w.workspaceId === 'ws-1')?.attention).toBe('error')
    expect(cat.workspaces.find(w => w.workspaceId === 'ws-2')?.attention).toBe('ongoing')
    expect(canonical.counts).toEqual({ all: 3, warning: 2, ongoing: 1, done: 0 })
  })

  it('orders pinned sessions at the top with pinned: true', () => {
    const ws = workspace('ws-1', '/Users/zcol/Project/SomePlugin', 'DSH Plugin', ['s1', 's2', 's3', 's4'])
    const list = listState([ws])
    const manual: ManualGroups = {
      categories: [],
      assignments: {},
      pinnedSessions: {
        'ws-1': ['s3', 's1'],
      },
    }
    const tree = deriveWorkspaceTree(list, [ws], [], CONFIG, manual)
    const cat = tree.categories.find(g => g.label === 'DSH Plugins')!
    const wsNode = cat.workspaces.find(w => w.workspaceId === 'ws-1')!
    expect(wsNode.sessions.map(s => s.id)).toEqual(['s3', 's1', 's2', 's4'])
    expect(wsNode.sessions[0]?.pinned).toBe(true)
    expect(wsNode.sessions[1]?.pinned).toBe(true)
    expect(wsNode.sessions[2]?.pinned).toBeUndefined()
    expect(wsNode.sessions[3]?.pinned).toBeUndefined()
  })

  it('ignores pinned sessions that are archived or nonexistent', () => {
    const ws = workspace('ws-1', '/Users/zcol/Project/SomePlugin', 'DSH Plugin', ['s1', 's2'])
    const list = listState([ws])
    const manual: ManualGroups = {
      categories: [],
      assignments: {},
      pinnedSessions: {
        'ws-1': ['nonexistent-sess', 's2'],
      },
    }
    const tree = deriveWorkspaceTree(list, [ws], ['s1' as never], CONFIG, manual)
    const cat = tree.categories.find(g => g.label === 'DSH Plugins')!
    const wsNode = cat.workspaces.find(w => w.workspaceId === 'ws-1')!
    expect(wsNode.sessions.map(s => s.id)).toEqual(['s2'])
    expect(wsNode.sessions[0]?.pinned).toBe(true)
  })

  it('copies overlay session colors onto session nodes', () => {
    const ws = workspace('ws-1', '/Users/zcol/Project/SomePlugin', 'DSH Plugin', ['s1', 's2'])
    const list = listState([ws])
    const manual: ManualGroups = {
      categories: [],
      assignments: {},
      colors: { s2: 'orange' },
    }
    const tree = deriveWorkspaceTree(list, [ws], [], CONFIG, manual)
    const cat = tree.categories.find(g => g.label === 'DSH Plugins')!
    const wsNode = cat.workspaces.find(w => w.workspaceId === 'ws-1')!
    expect(wsNode.sessions.find(s => s.id === 's1')?.color).toBeUndefined()
    expect(wsNode.sessions.find(s => s.id === 's2')?.color).toBe('orange')
  })

  it('restores done attention and counts from persisted completedSessions across reloads', () => {
    const ws = workspace('ws-1', '/Users/zcol/Project/SomePlugin', 'DSH Plugin', ['s1', 's2', 's3'])
    const list = listState([ws], 's3')
    const persistedCompleted = { s1: true, s2: true, s3: true }

    const tree = deriveWorkspaceTree(list, [ws], [], CONFIG, { categories: [], assignments: {} }, new Map(), persistedCompleted)
    const cat = tree.categories.find(g => g.label === 'DSH Plugins')!
    const wsNode = cat.workspaces.find(w => w.workspaceId === 'ws-1')!
    expect(wsNode.sessions.find(s => s.id === 's1')?.completed).toBe(true)
    expect(wsNode.sessions.find(s => s.id === 's2')?.completed).toBe(true)
    // Current session s3 never shows as unread completed
    expect(wsNode.sessions.find(s => s.id === 's3')?.completed).toBe(false)
    expect(wsNode.attention).toBe('done')
    expect(cat.attention).toBe('done')
    expect(tree.counts).toEqual({ all: 3, warning: 0, ongoing: 0, done: 2 })

    const search = deriveSearchGroups(list, [ws], CONFIG, new Set(['s1', 's3'] as never), [], { categories: [], assignments: {} }, undefined, new Map(), persistedCompleted)
    const searchSessions = search.categories[0]!.workspaces[0]!.sessions
    expect(searchSessions.find(s => s.id === 's1')?.completed).toBe(true)
    expect(searchSessions.find(s => s.id === 's3')?.completed).toBe(false)

    expect(deriveCompletionObservations(list, ['s2' as never])).toEqual([
      { id: 's1', running: false, completed: false },
      { id: 's3', running: false, completed: false },
    ])
  })
})
