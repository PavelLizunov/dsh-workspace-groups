/**
 * Tree-derivation tests: the renderer's data-shaping contract — manual
 * overrides win over rules, manual groups render while empty, rule buckets
 * hide while empty, and top-level (ungrouped) workspaces render as separate
 * rows after the group folders (no "uncategorized" bucket).
 * Pure derivation (no DOM), fixtures cast to the runtime contract types.
 *
 * The browser runtime bundle self-registers via window.__ModuleLoader__ and
 * cannot execute in a plain node process, so the one value import it provides
 * (`indexSubagentDescendants`) is stubbed; the fixtures carry no subagents.
 */
import { describe, expect, it, vi } from 'vitest'

const runtimeMocks = vi.hoisted(() => ({
  indexSubagentDescendants: vi.fn(() => new Map()),
}))
vi.mock('@deepseek-ai/dsh-client-runtime/client', () => runtimeMocks)

import type { SessionListState, SessionSummary, WorkspaceView } from '@deepseek-ai/dsh-client-runtime/client'
import { deriveGroups, deriveTopLevel, deriveWorkspaceTree, projectTreeExpansion, sessionAttention, workspaceLabel } from '../src/client/tree.ts'
import { ATTENTION_PROJECTION_KEY } from '../src/core/attention.ts'
import type { GroupsConfig, ManualGroups } from '../src/core/types.ts'

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
    const groups = deriveGroups(list, [ws1, ws2], [], CONFIG, VIEW, { categories: [], assignments: {} })
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

    const canonical = deriveWorkspaceTree(list, [ws1, ws2], [], CONFIG, { categories: [], assignments: {} })
    const cat = canonical.categories.find(g => g.label === 'DSH Plugins')!
    expect(cat.attention).toBe('error')
    expect(cat.workspaces.find(w => w.workspaceId === 'ws-1')?.attention).toBe('error')
    expect(cat.workspaces.find(w => w.workspaceId === 'ws-2')?.attention).toBe('ongoing')
    expect(canonical.counts).toEqual({ all: 3, warning: 2, ongoing: 1, done: 0 })
  })
})
