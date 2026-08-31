import { describe, expect, it, vi } from 'vitest'

vi.mock('@deepseek-ai/dsh-client-runtime/client', () => ({
  indexSubagentDescendants: () => new Map(),
}))

import type { SessionId, WorkspaceId } from '@deepseek-ai/dsh-client-runtime/client'
import type { CategoryNode, SessionNode, WorkspaceGroupNode } from '../src/client/tree.ts'
import {
  applySidebarFilter,
  DEFAULT_SIDEBAR_FILTER,
  sidebarFilterActive,
  type SidebarFilter,
} from '../src/client/tree-filter.ts'

const NOW = 1_700_000_000_000

function createSession(
  id: string,
  overrides?: Partial<SessionNode>,
): SessionNode {
  return {
    id: id as SessionId,
    title: `Session ${id}`,
    blank: false,
    running: false,
    runningSubagentCount: 0,
    completed: false,
    updatedAt: NOW - 3_600_000,
    ...overrides,
  }
}

function createWorkspace(
  workspaceId: string,
  sessions: SessionNode[],
  overrides?: Partial<WorkspaceGroupNode>,
): WorkspaceGroupNode {
  return {
    workspaceId: workspaceId as WorkspaceId,
    path: `/workspaces/${workspaceId}`,
    label: workspaceId,
    createdAt: NOW - 86_400_000,
    sessionCount: sessions.length,
    expanded: false,
    containsCurrent: false,
    sessions,
    ...overrides,
  }
}

function createCategory(
  key: string,
  workspaces: WorkspaceGroupNode[],
  overrides?: Partial<CategoryNode>,
): CategoryNode {
  return {
    key,
    label: key,
    expanded: false,
    containsCurrent: false,
    workspaces,
    ...overrides,
  }
}

describe('sidebarFilterActive', () => {
  it('returns false for DEFAULT_SIDEBAR_FILTER', () => {
    expect(sidebarFilterActive(DEFAULT_SIDEBAR_FILTER)).toBe(false)
  })

  it('returns true when status is not all', () => {
    expect(sidebarFilterActive({ ...DEFAULT_SIDEBAR_FILTER, status: 'warning' })).toBe(true)
  })

  it('returns true when recency is not all', () => {
    expect(sidebarFilterActive({ ...DEFAULT_SIDEBAR_FILTER, recency: '24h' })).toBe(true)
  })

  it('returns true when color is not null', () => {
    expect(sidebarFilterActive({ ...DEFAULT_SIDEBAR_FILTER, color: 'red' })).toBe(true)
  })
})

describe('applySidebarFilter - status filtering & counts', () => {
  const sWarning = createSession('s-warning', { pendingInteraction: 'approval' })
  const sOngoing = createSession('s-ongoing', { running: true })
  const sDone = createSession('s-done', { completed: true })
  const sIdle = createSession('s-idle', {})

  const wsGrouped = createWorkspace('ws-grouped', [sWarning, sOngoing, sDone, sIdle])
  const cat1 = createCategory('cat1', [wsGrouped])
  const wsTop = createWorkspace('ws-top', [sWarning, sIdle])

  it('computes correct counts for all status scopes under DEFAULT_SIDEBAR_FILTER', () => {
    const result = applySidebarFilter([cat1], [wsTop], DEFAULT_SIDEBAR_FILTER, {}, NOW)
    expect(result.counts).toEqual({
      all: 6,
      warning: 2,
      ongoing: 1,
      done: 1,
    })
    expect(result.categories.length).toBe(1)
    expect(result.topLevel.length).toBe(1)
    expect(result.categories[0]!.expanded).toBe(true)
    expect(result.categories[0]!.workspaces[0]!.expanded).toBe(true)
  })

  it('reuses an already-expanded canonical tree under the default filter', () => {
    const session = createSession('canonical-warning', { pendingInteraction: 'approval' })
    const workspace = createWorkspace('canonical-workspace', [session], { expanded: true, attention: 'warning' })
    const category = createCategory('canonical-category', [workspace], { expanded: true, attention: 'warning' })

    const result = applySidebarFilter([category], [], DEFAULT_SIDEBAR_FILTER, {}, NOW)

    expect(result.categories[0]).toBe(category)
    expect(result.categories[0]?.workspaces[0]).toBe(workspace)
    expect(result.counts).toEqual({ all: 1, warning: 1, ongoing: 0, done: 0 })
  })

  it('filters by status: warning including error states in warning scope while preserving error attention', () => {
    const sErr = createSession('s-err', { projectionReason: 'error' })
    const sAwaiting = createSession('s-awaiting', { projectionReason: 'awaiting-user' })
    const sIdle = createSession('s-idle', {})
    const ws = createWorkspace('ws-err-warn', [sErr, sAwaiting, sIdle])
    const cat = createCategory('cat-err', [ws])

    const filter: SidebarFilter = { status: 'warning', recency: 'all', color: null }
    const result = applySidebarFilter([cat], [], filter, {}, NOW)

    expect(result.counts.warning).toBe(2)
    expect(result.categories[0]!.workspaces[0]!.sessions.map(s => s.id)).toEqual(['s-err', 's-awaiting'])
    expect(result.categories[0]!.workspaces[0]!.attention).toBe('error')
    expect(result.categories[0]!.attention).toBe('error')
  })

  it('filters by status: ongoing', () => {
    const filter: SidebarFilter = { status: 'ongoing', recency: 'all', color: null }
    const result = applySidebarFilter([cat1], [wsTop], filter, {}, NOW)

    expect(result.categories[0]!.workspaces[0]!.sessions.map(s => s.id)).toEqual(['s-ongoing'])
    expect(result.categories[0]!.workspaces[0]!.attention).toBe('ongoing')
    expect(result.topLevel.length).toBe(0)
  })

  it('filters by status: done', () => {
    const filter: SidebarFilter = { status: 'done', recency: 'all', color: null }
    const result = applySidebarFilter([cat1], [wsTop], filter, {}, NOW)

    expect(result.categories[0]!.workspaces[0]!.sessions.map(s => s.id)).toEqual(['s-done'])
    expect(result.categories[0]!.workspaces[0]!.attention).toBe('done')
    expect(result.topLevel.length).toBe(0)
  })
})

describe('applySidebarFilter - recency filtering', () => {
  const HOUR = 3_600_000
  const DAY = 24 * HOUR

  const sRecent = createSession('s-recent', { updatedAt: NOW - 12 * HOUR })
  const s3Days = createSession('s-3d', { updatedAt: NOW - 3 * DAY })
  const s10Days = createSession('s-10d', { updatedAt: NOW - 10 * DAY })
  const s40Days = createSession('s-40d', { updatedAt: NOW - 40 * DAY })
  const sExactCutoff = createSession('s-exact', { updatedAt: NOW - 24 * HOUR })

  const ws = createWorkspace('ws-recency', [sRecent, s3Days, s10Days, s40Days, sExactCutoff])
  const cat = createCategory('cat-recency', [ws])

  it('filters by 24h (inclusive cutoff)', () => {
    const filter: SidebarFilter = { status: 'all', recency: '24h', color: null }
    const result = applySidebarFilter([cat], [], filter, {}, NOW)

    const sessionIds = result.categories[0]!.workspaces[0]!.sessions.map(s => s.id)
    expect(sessionIds).toEqual(['s-recent', 's-exact'])
    expect(result.counts.all).toBe(2)
  })

  it('filters by 7d', () => {
    const filter: SidebarFilter = { status: 'all', recency: '7d', color: null }
    const result = applySidebarFilter([cat], [], filter, {}, NOW)

    const sessionIds = result.categories[0]!.workspaces[0]!.sessions.map(s => s.id)
    expect(sessionIds).toEqual(['s-recent', 's-3d', 's-exact'])
    expect(result.counts.all).toBe(3)
  })

  it('filters by 30d', () => {
    const filter: SidebarFilter = { status: 'all', recency: '30d', color: null }
    const result = applySidebarFilter([cat], [], filter, {}, NOW)

    const sessionIds = result.categories[0]!.workspaces[0]!.sessions.map(s => s.id)
    expect(sessionIds).toEqual(['s-recent', 's-3d', 's-10d', 's-exact'])
    expect(result.counts.all).toBe(4)
  })
})

describe('applySidebarFilter - color preset filtering', () => {
  const wsGrouped1 = createWorkspace('ws-g1', [createSession('s1')])
  const wsGrouped2 = createWorkspace('ws-g2', [createSession('s2')])
  const catGroupRed = createCategory('cat-red', [wsGrouped1, wsGrouped2])

  const wsGrouped3 = createWorkspace('ws-g3', [createSession('s3')])
  const wsGrouped4 = createWorkspace('ws-g4', [createSession('s4')])
  const catGroupUncolored = createCategory('cat-plain', [wsGrouped3, wsGrouped4])

  const wsTopRed = createWorkspace('ws-top-red', [createSession('s5')])
  const wsTopBlue = createWorkspace('ws-top-blue', [createSession('s6')])

  const colors: Record<string, string | null> = {
    'cat-red': 'red',
    'ws-g1': 'blue',
    'ws-g3': 'red',
    'ws-top-red': 'red',
    'ws-top-blue': 'blue',
  }

  it('includes whole group when category color matches target color', () => {
    const filter: SidebarFilter = { status: 'all', recency: 'all', color: 'red' }
    const result = applySidebarFilter([catGroupRed, catGroupUncolored], [wsTopRed, wsTopBlue], filter, colors, NOW)

    const catRedWs = result.categories.find(c => c.key === 'cat-red')?.workspaces.map(w => w.workspaceId)
    expect(catRedWs).toEqual(['ws-g1', 'ws-g2'])

    const catPlainWs = result.categories.find(c => c.key === 'cat-plain')?.workspaces.map(w => w.workspaceId)
    expect(catPlainWs).toEqual(['ws-g3'])

    const topWs = result.topLevel.map(w => w.workspaceId)
    expect(topWs).toEqual(['ws-top-red'])

    expect(result.counts.all).toBe(4)
  })
})

describe('applySidebarFilter - counts apply color+recency before status', () => {
  const sWarning = createSession('s-warn', { pendingInteraction: 'approval' })
  const sDone = createSession('s-done', { completed: true })
  const ws = createWorkspace('ws-1', [sWarning, sDone])
  const cat = createCategory('cat-1', [ws])

  it('counts warning, done, and all even when status filter is set to warning', () => {
    const filter: SidebarFilter = { status: 'warning', recency: 'all', color: null }
    const result = applySidebarFilter([cat], [], filter, {}, NOW)

    expect(result.categories[0]!.workspaces[0]!.sessions.map(s => s.id)).toEqual(['s-warn'])
    expect(result.counts).toEqual({
      all: 2,
      warning: 1,
      ongoing: 0,
      done: 1,
    })
  })
})

describe('applySidebarFilter - combined filters', () => {
  it('applies color and recency to counts before selecting the requested status', () => {
    const day = 24 * 3600 * 1000
    const recentWarning = createSession('recent-warning', { pendingInteraction: 'approval', updatedAt: NOW - day })
    const recentDone = createSession('recent-done', { completed: true, updatedAt: NOW - day })
    const oldWarning = createSession('old-warning', { pendingInteraction: 'approval', updatedAt: NOW - 10 * day })
    const redWorkspace = createWorkspace('ws-red', [recentWarning, recentDone, oldWarning])
    const blueWorkspace = createWorkspace('ws-blue', [createSession('blue-warning', { pendingInteraction: 'approval' })])
    const filter: SidebarFilter = { status: 'warning', recency: '7d', color: 'red' }

    const result = applySidebarFilter(
      [createCategory('cat-red', [redWorkspace]), createCategory('cat-blue', [blueWorkspace])],
      [],
      filter,
      { 'cat-red': 'red', 'cat-blue': 'blue' },
      NOW,
    )

    expect(result.counts).toEqual({ all: 2, warning: 1, ongoing: 0, done: 1 })
    expect(result.categories).toHaveLength(1)
    expect(result.categories[0]?.workspaces[0]?.sessions.map(session => session.id)).toEqual(['recent-warning'])
  })
})

describe('applySidebarFilter - hiding empty nodes and immutability', () => {
  const sOld = createSession('s-old', { updatedAt: NOW - 100 * 24 * 3600 * 1000 })
  const wsEmpty = createWorkspace('ws-empty', [sOld])
  const catEmpty = createCategory('cat-empty', [wsEmpty])

  it('hides empty categories and workspaces when sessions do not match', () => {
    const filter: SidebarFilter = { status: 'all', recency: '24h', color: null }
    const result = applySidebarFilter([catEmpty], [wsEmpty], filter, {}, NOW)

    expect(result.categories.length).toBe(0)
    expect(result.topLevel.length).toBe(0)
    expect(result.counts.all).toBe(0)
  })

  it('preserves input immutability', () => {
    const session = createSession('s1')
    const ws = createWorkspace('ws1', [session])
    const cat = createCategory('cat1', [ws])

    const origCat = JSON.parse(JSON.stringify(cat))
    const origWs = JSON.parse(JSON.stringify(ws))

    applySidebarFilter([cat], [ws], { status: 'warning', recency: '24h', color: 'red' }, {}, NOW)

    expect(cat).toEqual(origCat)
    expect(ws).toEqual(origWs)
  })
})
