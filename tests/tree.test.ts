/**
 * Tree-derivation tests: the renderer's data-shaping contract — manual
 * overrides win over rules, manual groups render while empty, rule buckets
 * hide while empty, and the uncategorized bucket collects the rest.
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
import { deriveGroups } from '../src/client/tree.ts'
import { UNCATEGORIZED_LABEL, type GroupsConfig, type ManualGroups } from '../src/core/types.ts'

const CONFIG: GroupsConfig = {
  categories: [
    { name: 'DSH 插件', rules: [{ nameContains: '插件' }] },
    { name: '文档', rules: [{ basenameContains: 'docs' }] },
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
    for (const id of ws.sessionIds) byId[id] = session(id, `会话-${id}`)
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

describe('deriveGroups with the manual overlay', () => {
  const workspaces = [
    workspace('ws-a', '/Users/zcol/Project/SomePlugin', 'DSH插件Demo'),
    workspace('ws-b', '/Users/zcol/Project/MyDocs', 'MyDocs'),
    workspace('ws-c', '/tmp/random', 'Random'),
  ]

  it('groups by rules without an overlay', () => {
    const groups = deriveGroups(listState(workspaces), workspaces, [], CONFIG, VIEW, { categories: [], assignments: {} })
    const labels = groups.map(g => g.label)
    expect(labels).toEqual(['DSH 插件', '文档', UNCATEGORIZED_LABEL])
    expect(groups[0]?.workspaces.map(w => w.workspaceId)).toEqual(['ws-a'])
    expect(groups[1]?.workspaces.map(w => w.workspaceId)).toEqual(['ws-b'])
    expect(groups[2]?.workspaces.map(w => w.workspaceId)).toEqual(['ws-c'])
  })

  it('a manual override moves a workspace into a manual group', () => {
    const manual: ManualGroups = { categories: ['临时'], assignments: { 'ws-a': '临时' } }
    const groups = deriveGroups(listState(workspaces), workspaces, [], CONFIG, VIEW, manual)
    const byLabel = new Map(groups.map(g => [g.label, g]))
    expect(byLabel.get('临时')?.workspaces.map(w => w.workspaceId)).toEqual(['ws-a'])
    // ws-a left the rule bucket; with nothing left, the empty rule bucket hides.
    expect(byLabel.has('DSH 插件')).toBe(false)
    expect(byLabel.get('文档')?.workspaces.map(w => w.workspaceId)).toEqual(['ws-b'])
  })

  it('an empty manual group still renders (a new group appears before any drop)', () => {
    const manual: ManualGroups = { categories: ['临时'], assignments: {} }
    const groups = deriveGroups(listState(workspaces), workspaces, [], CONFIG, VIEW, manual)
    const byLabel = new Map(groups.map(g => [g.label, g]))
    expect(byLabel.has('临时')).toBe(true)
    expect(byLabel.get('临时')?.workspaces).toEqual([])
  })

  it('an empty rule bucket stays hidden', () => {
    const manual: ManualGroups = { categories: [], assignments: {} }
    const groups = deriveGroups(listState([]), [], [], CONFIG, VIEW, manual)
    expect(groups).toEqual([])
  })

  it('drops into the uncategorized bucket are represented by absent overrides', () => {
    // ws-a overridden to 临时; override removed → rule classification applies again.
    const withOverride: ManualGroups = { categories: ['临时'], assignments: { 'ws-a': '临时' } }
    const moved = deriveGroups(listState(workspaces), workspaces, [], CONFIG, VIEW, withOverride)
    expect(moved.find(g => g.label === '临时')?.workspaces).toHaveLength(1)

    const reverted: ManualGroups = { categories: ['临时'], assignments: {} }
    const back = deriveGroups(listState(workspaces), workspaces, [], CONFIG, VIEW, reverted)
    expect(back.find(g => g.label === '临时')?.workspaces).toHaveLength(0)
    expect(back.find(g => g.label === 'DSH 插件')?.workspaces.map(w => w.workspaceId)).toEqual(['ws-a'])
  })

  it('a null override forces the uncategorized bucket (rule match ignored)', () => {
    const manual: ManualGroups = { categories: [], assignments: { 'ws-a': null } }
    const groups = deriveGroups(listState(workspaces), workspaces, [], CONFIG, VIEW, manual)
    const byLabel = new Map(groups.map(g => [g.label, g]))
    // ws-a forced to uncategorized; ws-c matches no rule and sits there too.
    expect(byLabel.get(UNCATEGORIZED_LABEL)?.workspaces.map(w => w.workspaceId)).toEqual(['ws-a', 'ws-c'])
    expect(byLabel.has('DSH 插件')).toBe(false)
  })

  it('stored workspace order wins inside a bucket', () => {
    const manual: ManualGroups = {
      categories: [],
      assignments: {},
      workspaceOrder: { 'DSH 插件': ['ws-a2', 'ws-a1'] },
    }
    const ws = [
      workspace('ws-a1', '/Users/zcol/Project/AA', '插件A1'),
      workspace('ws-a2', '/Users/zcol/Project/BB', '插件A2'),
    ]
    const groups = deriveGroups(listState(ws), ws, [], CONFIG, VIEW, manual)
    expect(groups.find(g => g.label === 'DSH 插件')?.workspaces.map(w => w.workspaceId)).toEqual(['ws-a2', 'ws-a1'])
  })

  it('the uncategorized bucket is always the last section', () => {
    const manual: ManualGroups = {
      categories: ['临时'],
      assignments: { 'ws-b': '临时', 'ws-c': null },
      categoryOrder: ['临时'],
    }
    const groups = deriveGroups(listState(workspaces), workspaces, [], CONFIG, VIEW, manual)
    expect(groups[groups.length - 1]?.label).toBe(UNCATEGORIZED_LABEL)
    // ws-c (forced uncategorized) and any rule-less workspaces sit at the bottom.
    expect(groups[groups.length - 1]?.workspaces.map(w => w.workspaceId)).toEqual(['ws-c'])
  })

  it('a renamed rule category renders under the new name', () => {
    const manual: ManualGroups = { categories: [], assignments: {}, renamed: { 'DSH 插件': '插件集' } }
    const groups = deriveGroups(listState(workspaces), workspaces, [], CONFIG, VIEW, manual)
    const byLabel = new Map(groups.map(g => [g.label, g]))
    expect(byLabel.has('插件集')).toBe(true)
    expect(byLabel.get('插件集')?.workspaces.map(w => w.workspaceId)).toEqual(['ws-a'])
    expect(byLabel.has('DSH 插件')).toBe(false)
  })

  it('a hidden rule category is inert — its members fall to uncategorized', () => {
    const manual: ManualGroups = { categories: [], assignments: {}, hidden: ['DSH 插件'] }
    const groups = deriveGroups(listState(workspaces), workspaces, [], CONFIG, VIEW, manual)
    const byLabel = new Map(groups.map(g => [g.label, g]))
    expect(byLabel.get(UNCATEGORIZED_LABEL)?.workspaces.map(w => w.workspaceId)).toEqual(['ws-a', 'ws-c'])
  })
})
