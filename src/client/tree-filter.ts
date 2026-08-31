/**
 * Pure filtering model for sidebar tree views (categories and workspaces).
 * Filters sessions by status, recency, and color preset tags, returning
 * filtered category and top-level workspace nodes alongside aggregated status counts.
 */
import {
  DEFAULT_SIDEBAR_FILTER,
  type ColorPreset,
  type RecencyScope,
  type SidebarFilterPreferences,
  type StatusScope,
} from '../core/types.ts'
import {
  sessionAttention,
  type AttentionState,
  type CategoryNode,
  type SessionNode,
  type WorkspaceGroupNode,
} from './tree.ts'

export { DEFAULT_SIDEBAR_FILTER }
export type { ColorPreset, RecencyScope, StatusScope }
export type SidebarFilter = SidebarFilterPreferences

export interface FilterCounts {
  all: number
  warning: number
  ongoing: number
  done: number
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

function aggregateCategoryAttention(workspaces: readonly WorkspaceGroupNode[]): AttentionState | undefined {
  let hasWarning = false
  let hasOngoing = false
  let hasDone = false
  for (const ws of workspaces) {
    if (ws.attention === 'error') return 'error'
    if (ws.attention === 'warning') hasWarning = true
    else if (ws.attention === 'ongoing') hasOngoing = true
    else if (ws.attention === 'done') hasDone = true
  }
  if (hasWarning) return 'warning'
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

  if (filter.status === 'all' && filter.recency === 'all' && filter.color === null) {
    const expandWorkspace = (workspace: WorkspaceGroupNode): WorkspaceGroupNode => {
      let attention: AttentionState | undefined
      for (const session of workspace.sessions) {
        counts.all++
        const state = sessionAttention(session)
        if (state === 'error' || state === 'warning') {
          counts.warning++
          if (state === 'error') attention = 'error'
          else if (attention !== 'error') attention = 'warning'
        } else if (state === 'ongoing') {
          counts.ongoing++
          if (attention !== 'error' && attention !== 'warning') attention = 'ongoing'
        } else if (state === 'done') {
          counts.done++
          if (attention === undefined) attention = 'done'
        }
      }
      if (
        workspace.expanded
        && workspace.sessionCount === workspace.sessions.length
        && workspace.attention === attention
      ) {
        return workspace
      }
      const { attention: _previousAttention, ...workspaceRest } = workspace
      return {
        ...workspaceRest,
        sessionCount: workspace.sessions.length,
        expanded: true,
        ...(attention === undefined ? {} : { attention }),
      }
    }
    const expandedCategories = categories.map(category => {
      const workspaces = category.workspaces.map(expandWorkspace)
      const attention = aggregateCategoryAttention(workspaces)
      if (
        category.expanded
        && category.attention === attention
        && workspaces.every((workspace, index) => workspace === category.workspaces[index])
      ) {
        return category
      }
      const { attention: _previousAttention, ...categoryRest } = category
      return {
        ...categoryRest,
        expanded: true,
        workspaces,
        ...(attention === undefined ? {} : { attention }),
      }
    })
    return {
      categories: expandedCategories,
      topLevel: topLevel.map(expandWorkspace),
      counts,
    }
  }

  function filterWorkspace(
    workspace: WorkspaceGroupNode,
    categoryKey: string | undefined,
  ): WorkspaceGroupNode | null {
    if (!isWorkspaceColorMatched(workspace.workspaceId, categoryKey, filter.color, colors)) {
      return null
    }

    const matchedSessions: SessionNode[] = []
    let matchedAttention: AttentionState | undefined
    for (const session of workspace.sessions) {
      if (session.updatedAt < cutoff) continue
      counts.all++
      const state = sessionAttention(session)
      if (state === 'error' || state === 'warning') counts.warning++
      else if (state === 'ongoing') counts.ongoing++
      else if (state === 'done') counts.done++

      const matchesStatus = filter.status === 'all'
        || (filter.status === 'warning' ? (state === 'warning' || state === 'error') : state === filter.status)
      if (!matchesStatus) continue

      matchedSessions.push(session)
      if (state === 'error') matchedAttention = 'error'
      else if (state === 'warning' && matchedAttention !== 'error') matchedAttention = 'warning'
      else if (state === 'ongoing' && matchedAttention !== 'error' && matchedAttention !== 'warning') matchedAttention = 'ongoing'
      else if (state === 'done' && matchedAttention === undefined) matchedAttention = 'done'
    }

    if (matchedSessions.length === 0) return null

    const { attention: _previousAttention, ...workspaceRest } = workspace
    return {
      ...workspaceRest,
      sessionCount: matchedSessions.length,
      expanded: true,
      sessions: matchedSessions,
      ...(matchedAttention === undefined ? {} : { attention: matchedAttention }),
    }
  }

  const filteredCategories: CategoryNode[] = []
  for (const category of categories) {
    const matchedWorkspaces: WorkspaceGroupNode[] = []
    for (const workspace of category.workspaces) {
      const matched = filterWorkspace(workspace, category.key)
      if (matched !== null) matchedWorkspaces.push(matched)
    }
    if (matchedWorkspaces.length === 0) continue
    const { attention: _previousAttention, ...categoryRest } = category
    const attention = aggregateCategoryAttention(matchedWorkspaces)
    filteredCategories.push({
      ...categoryRest,
      expanded: true,
      workspaces: matchedWorkspaces,
      ...(attention === undefined ? {} : { attention }),
    })
  }

  const filteredTopLevel: WorkspaceGroupNode[] = []
  for (const workspace of topLevel) {
    const matched = filterWorkspace(workspace, undefined)
    if (matched !== null) filteredTopLevel.push(matched)
  }

  return {
    categories: filteredCategories,
    topLevel: filteredTopLevel,
    counts,
  }
}
