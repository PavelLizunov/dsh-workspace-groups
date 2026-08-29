/**
 * Pure filtering model for sidebar tree views (categories and workspaces).
 * Filters sessions by status, recency, and color preset tags, returning
 * filtered category and top-level workspace nodes alongside aggregated status counts.
 */
import {
  sessionAttention,
  type AttentionState,
  type CategoryNode,
  type SessionNode,
  type WorkspaceGroupNode,
} from './tree.ts'

export type ColorPreset = 'red' | 'orange' | 'yellow' | 'green' | 'cyan' | 'blue' | 'purple' | 'pink'
export type StatusScope = 'all' | 'warning' | 'ongoing' | 'done'
export type RecencyScope = 'all' | '24h' | '7d' | '30d'

export interface SidebarFilter {
  status: StatusScope
  recency: RecencyScope
  color: ColorPreset | null
}

export interface FilterCounts {
  all: number
  warning: number
  ongoing: number
  done: number
}

export const DEFAULT_SIDEBAR_FILTER: SidebarFilter = {
  status: 'all',
  recency: 'all',
  color: null,
}

export function sidebarFilterActive(filter: SidebarFilter): boolean {
  return filter.status !== 'all' || filter.recency !== 'all' || filter.color !== null
}

function getRecencyCutoff(recency: RecencyScope, now: number): number {
  switch (recency) {
    case '24h':
      return now - 24 * 60 * 60 * 1000
    case '7d':
      return now - 7 * 24 * 60 * 60 * 1000
    case '30d':
      return now - 30 * 24 * 60 * 60 * 1000
    case 'all':
    default:
      return -Infinity
  }
}

function isWorkspaceColorMatched(
  workspaceId: string,
  categoryKey: string | undefined,
  targetColor: ColorPreset | null,
  colors?: Record<string, string | null>,
): boolean {
  if (targetColor === null) return true
  if (categoryKey !== undefined && colors?.[categoryKey] === targetColor) {
    return true
  }
  return colors?.[workspaceId] === targetColor
}

function aggregateWorkspaceAttention(sessions: readonly SessionNode[]): AttentionState | undefined {
  let hasOngoing = false
  let hasDone = false
  for (const session of sessions) {
    const state = sessionAttention(session)
    if (state === 'warning') return 'warning'
    if (state === 'ongoing') hasOngoing = true
    else if (state === 'done') hasDone = true
  }
  if (hasOngoing) return 'ongoing'
  if (hasDone) return 'done'
  return undefined
}

function aggregateCategoryAttention(workspaces: readonly WorkspaceGroupNode[]): AttentionState | undefined {
  let hasOngoing = false
  let hasDone = false
  for (const ws of workspaces) {
    if (ws.attention === 'warning') return 'warning'
    if (ws.attention === 'ongoing') hasOngoing = true
    else if (ws.attention === 'done') hasDone = true
  }
  if (hasOngoing) return 'ongoing'
  if (hasDone) return 'done'
  return undefined
}

export function applySidebarFilter(
  categories: readonly CategoryNode[],
  topLevel: readonly WorkspaceGroupNode[],
  filter: SidebarFilter,
  colors: Record<string, string | null> | undefined,
  now: number,
): {
  categories: CategoryNode[]
  topLevel: WorkspaceGroupNode[]
  counts: FilterCounts
} {
  const cutoff = getRecencyCutoff(filter.recency, now)
  const counts: FilterCounts = { all: 0, warning: 0, ongoing: 0, done: 0 }

  // First pass: compute counts across all sessions matching color + recency
  for (const category of categories) {
    for (const ws of category.workspaces) {
      if (!isWorkspaceColorMatched(ws.workspaceId, category.key, filter.color, colors)) {
        continue
      }
      for (const session of ws.sessions) {
        if (session.updatedAt >= cutoff) {
          counts.all++
          const attn = sessionAttention(session)
          if (attn === 'warning') counts.warning++
          else if (attn === 'ongoing') counts.ongoing++
          else if (attn === 'done') counts.done++
        }
      }
    }
  }

  for (const ws of topLevel) {
    if (!isWorkspaceColorMatched(ws.workspaceId, undefined, filter.color, colors)) {
      continue
    }
    for (const session of ws.sessions) {
      if (session.updatedAt >= cutoff) {
        counts.all++
        const attn = sessionAttention(session)
        if (attn === 'warning') counts.warning++
        else if (attn === 'ongoing') counts.ongoing++
        else if (attn === 'done') counts.done++
      }
    }
  }

  // Second pass: filter workspaces and categories
  function filterWorkspace(
    ws: WorkspaceGroupNode,
    categoryKey: string | undefined,
  ): WorkspaceGroupNode | null {
    if (!isWorkspaceColorMatched(ws.workspaceId, categoryKey, filter.color, colors)) {
      return null
    }

    const matchedSessions: SessionNode[] = []
    for (const session of ws.sessions) {
      if (session.updatedAt < cutoff) continue
      if (filter.status !== 'all') {
        const attn = sessionAttention(session)
        if (attn !== filter.status) continue
      }
      matchedSessions.push(session)
    }

    if (matchedSessions.length === 0) {
      return null
    }

    const { attention: _prevAttn, ...wsRest } = ws
    const attention = aggregateWorkspaceAttention(matchedSessions)

    return {
      ...wsRest,
      sessionCount: matchedSessions.length,
      expanded: true,
      sessions: matchedSessions,
      ...(attention === undefined ? {} : { attention }),
    }
  }

  const filteredCategories: CategoryNode[] = []
  for (const category of categories) {
    const matchedWorkspaces: WorkspaceGroupNode[] = []
    for (const ws of category.workspaces) {
      const filteredWs = filterWorkspace(ws, category.key)
      if (filteredWs !== null) {
        matchedWorkspaces.push(filteredWs)
      }
    }
    if (matchedWorkspaces.length > 0) {
      const { attention: _prevAttn, ...categoryRest } = category
      const attention = aggregateCategoryAttention(matchedWorkspaces)
      filteredCategories.push({
        ...categoryRest,
        expanded: true,
        workspaces: matchedWorkspaces,
        ...(attention === undefined ? {} : { attention }),
      })
    }
  }

  const filteredTopLevel: WorkspaceGroupNode[] = []
  for (const ws of topLevel) {
    const filteredWs = filterWorkspace(ws, undefined)
    if (filteredWs !== null) {
      filteredTopLevel.push(filteredWs)
    }
  }

  return {
    categories: filteredCategories,
    topLevel: filteredTopLevel,
    counts,
  }
}
