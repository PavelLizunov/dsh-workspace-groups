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

vi.mock('@deepseek-ai/dsh-client-runtime/client', () => ({
  indexSubagentDescendants: () => new Map(),
}))

import type { SessionListState, SessionSummary, WorkspaceView } from '@deepseek-ai/dsh-client-runtime/client'
import { deriveGroups, deriveTopLevel, workspaceLabel } from '../src/client/tree.ts'
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
