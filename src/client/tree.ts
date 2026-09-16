/**
 * Derives the three-level workspace-groups tree: category folder → workspace folder →
 * session row. Pure derivation — all inputs are snapshots; the renderer never
 * scans. Session visibility rules mirror the official ui-workspace tree
 * (blank rows only when current, archived excluded, subagent rows excluded).
 */
import {
  indexSubagentDescendants,
  type PendingInteractionStatus,
  type SessionId,
  type SessionListState,
  type SessionSummary,
  type SubagentDescendantSummary,
  type WorkspaceId,
  type WorkspaceView,
} from '@deepseek-ai/dsh-client-runtime/client'
import { readAttentionProjection, type SessionAttentionReason } from '../core/attention.ts'
import {
  effectiveCategories,
  orderedWorkspaceIds,
  resolveCategory,
  PATH_SEPARATOR_RE,
  TRAILING_SLASHES_RE,
} from '../core/matcher.ts'
import { TOP_LEVEL_ORDER_KEY, UNCATEGORIZED_LABEL, type GroupsConfig, type ManualGroups } from '../core/types.ts'
import {
  type AttentionState,
  sessionAttention,
  aggregateAttention,
  aggregateCategoryAttention,
} from './tree-attention.ts'

const UNKNOWN_WORKSPACE_LABEL = 'Unknown workspace'

export type { AttentionState } from './tree-attention.ts'
export { sessionAttention, aggregateAttention, aggregateCategoryAttention } from './tree-attention.ts'
export type { SearchMatchSet, SearchTree } from './tree-search.ts'
export { byRecency, deriveSearchMatches, deriveSearchGroups } from './tree-search.ts'

/** One top-level session row inside a workspace folder. */
export interface SessionNode {
  id: SessionId
  /** Stored display title; blank rows show the localized New Session label. */
  title: string
  /** The provisional blank session (renderer shows the localized New Session title). */
  blank: boolean
  pendingInteraction?: PendingInteractionStatus
  running: boolean
  /** Running descendants connected through uninterrupted subagent-origin lineage. */
  runningSubagentCount: number
  /** Finished running while not selected and not yet opened (the green "done" reminder dot). */
  completed: boolean
  updatedAt: number
  /** Search-hit marker (rendered with a highlighted tint in search mode). */
  matched?: boolean
  /** Content-match snippet from the Host search (search mode only). */
  snippet?: string
  projectionReason?: SessionAttentionReason
  /** True when the session is pinned to the top of its workspace. */
  pinned?: boolean
  /** Color ping from the overlay (`manual.colors[sessionId]`). */
  color?: string
}

/** One workspace folder row inside a category folder. */
export interface WorkspaceGroupNode {
  workspaceId: WorkspaceId
  /** Canonical host directory path. */
  path: string
  /** Display title. */
  label: string
  /** Workspace creation time (epoch ms). */
  createdAt: number
  /** Total visible sessions in the folder. */
  sessionCount: number
  expanded: boolean
  /** The folder contains the selected session (active folder tint). */
  containsCurrent: boolean
  /** Visible session rows (empty while the folder is folded). */
  sessions: readonly SessionNode[]
  /** Aggregated child-session attention state for collapsed workspace rows. */
  attention?: AttentionState
}

/** One category folder at the top of the tree. */
export interface CategoryNode {
  /** Stable category key: the configured label, or the uncategorized bucket. */
  key: string
  /** Display label. */
  label: string
  expanded: boolean
  /** The category contains the selected session (active folder tint). */
  containsCurrent: boolean
  /** Workspace folders in host order. */
  workspaces: readonly WorkspaceGroupNode[]
  /** Aggregated child-session attention state for collapsed category rows. */
  attention?: AttentionState
}

/** Viewing state consumed by the derivation. */
export interface GroupsTreeView {
  expandedCategories: readonly string[]
  expandedWorkspaces: readonly string[]
}

/** Attention counts collected while building the canonical session nodes. */
export interface WorkspaceTreeCounts {
  all: number
  warning: number
  ongoing: number
  done: number
}

/** Fully populated grouped and top-level branches for one session snapshot. */
export interface WorkspaceTree {
  categories: readonly CategoryNode[]
  topLevel: readonly WorkspaceGroupNode[]
  counts: WorkspaceTreeCounts
}

/** Key of the uncategorized bucket (matches the config fallback label). */
export const UNCATEGORIZED_KEY = UNCATEGORIZED_LABEL

/** Directory display label: basename of the path (both separators accepted). */
export function workspaceLabel(cwd: string | undefined): string {
  if (cwd === undefined || cwd === '') return UNKNOWN_WORKSPACE_LABEL
  const base = cwd.replace(TRAILING_SLASHES_RE, '').split(PATH_SEPARATOR_RE).pop()
  return base !== undefined && base !== '' ? base : cwd
}

/** Ordinary sessions are visible; blank only when current; archived/subagent never. */
export function sessionVisible(session: SessionSummary, current: SessionId | undefined, archived: ReadonlySet<SessionId>): boolean {
  return session.origin !== 'subagent'
    && !archived.has(session.id)
    && (!session.blank || session.id === current)
}

/** Blank rows display the localized New Session label (never enters search). */
export function sessionTitle(session: SessionSummary): string {
  return session.blank ? 'New Session' : session.displayTitle
}

export function sessionNode(
  s: SessionSummary,
  descendants: ReadonlyMap<SessionId, SubagentDescendantSummary>,
  pinned?: boolean,
  color?: string | null,
): SessionNode {
  const projection = readAttentionProjection(s.projectionValues)
  return {
    id: s.id,
    title: sessionTitle(s),
    blank: s.blank,
    running: s.running,
    runningSubagentCount: descendants.get(s.id)?.runningCount ?? 0,
    completed: s.completed === true,
    updatedAt: s.updatedAt,
    ...(s.pendingInteraction === undefined ? {} : { pendingInteraction: s.pendingInteraction }),
    ...(projection.reason === null ? {} : { projectionReason: projection.reason }),
    ...(pinned ? { pinned: true } : {}),
    ...(typeof color === 'string' && color !== '' ? { color } : {}),
  }
}

/** Visible sessions of one workspace in its stored account order, with pinned sessions at the top. */
function workspaceSessions(
  list: SessionListState,
  workspace: WorkspaceView,
  archived: ReadonlySet<SessionId>,
  descendants: ReadonlyMap<SessionId, SubagentDescendantSummary>,
  pinnedIds?: readonly string[],
  onSession?: (session: SessionNode) => void,
  colors?: Record<string, string | null>,
): SessionNode[] {
  const pinnedSet = new Set(pinnedIds ?? [])
  const visibleMap = new Map<SessionId, SessionNode>()
  for (const id of workspace.sessionIds) {
    const summary = list.byId[id]
    if (summary === undefined) continue // account may lead the list pull; appears when the summary lands
    if (!sessionVisible(summary, list.current, archived)) continue
    const node = sessionNode(summary, descendants, pinnedSet.has(id), colors?.[id])
    visibleMap.set(id, node)
  }

  const nodes: SessionNode[] = []
  if (pinnedIds !== undefined) {
    for (const id of pinnedIds) {
      const node = visibleMap.get(id as SessionId)
      if (node !== undefined) {
        nodes.push(node)
        onSession?.(node)
      }
    }
  }
  for (const id of workspace.sessionIds) {
    if (pinnedSet.has(id)) continue
    const node = visibleMap.get(id)
    if (node !== undefined) {
      nodes.push(node)
      onSession?.(node)
    }
  }
  return nodes
}

/** Build the fully populated grouped and top-level tree once per list snapshot. */
export function deriveWorkspaceTree(
  list: SessionListState,
  workspaces: readonly WorkspaceView[],
  archivedSessionIds: readonly SessionId[],
  config: GroupsConfig,
  manual: ManualGroups,
): WorkspaceTree {
  const archived = new Set(archivedSessionIds)
  const descendants = indexSubagentDescendants(list.byId)
  const categoryKeys = effectiveCategories(config, manual).map(({ key }) => key)
  const validCategoryKeys = new Set(categoryKeys)
  const byCategory = new Map(categoryKeys.map(key => [key, [] as WorkspaceView[]]))
  const topLevelWorkspaces: WorkspaceView[] = []
  const counts: WorkspaceTreeCounts = { all: 0, warning: 0, ongoing: 0, done: 0 }
  const countSession = (session: SessionNode): void => {
    counts.all++
    const attention = sessionAttention(session)
    if (attention === 'error' || attention === 'warning') counts.warning++
    else if (attention === 'ongoing') counts.ongoing++
    else if (attention === 'done') counts.done++
  }
  let currentWorkspaceId: WorkspaceId | undefined

  for (const workspace of workspaces) {
    if (currentWorkspaceId === undefined && list.current !== undefined && workspace.sessionIds.includes(list.current)) {
      currentWorkspaceId = workspace.workspaceId
    }
    const key = resolveCategory(config, manual, workspace.workspaceId, workspace.path, workspace.title, validCategoryKeys)
    if (key === undefined) {
      topLevelWorkspaces.push(workspace)
      continue
    }
    if (!byCategory.has(key)) byCategory.set(key, [])
    byCategory.get(key)!.push(workspace)
  }

  const workspaceNode = (workspace: WorkspaceView): WorkspaceGroupNode => {
    const pinnedIds = manual.pinnedSessions?.[workspace.workspaceId]
    const sessions = workspaceSessions(list, workspace, archived, descendants, pinnedIds, countSession, manual.colors)
    const attention = aggregateAttention(sessions)
    return {
      workspaceId: workspace.workspaceId,
      path: workspace.path,
      label: workspace.title,
      createdAt: Date.parse(workspace.createdAt),
      sessionCount: sessions.length,
      expanded: true,
      containsCurrent: workspace.workspaceId === currentWorkspaceId,
      sessions,
      ...(attention === undefined ? {} : { attention }),
    }
  }

  const manualCategories = new Set(manual.categories)
  const categories: CategoryNode[] = []
  for (const key of categoryKeys) {
    const bucket = byCategory.get(key) ?? []
    if (bucket.length === 0 && !manualCategories.has(key)) continue
    const byId = new Map(bucket.map(workspace => [workspace.workspaceId as string, workspace]))
    const workspaceNodes = orderedWorkspaceIds(manual, key, [...byId.keys()])
      .flatMap(workspaceId => {
        const workspace = byId.get(workspaceId)
        return workspace === undefined ? [] : [workspaceNode(workspace)]
      })
    const attention = aggregateCategoryAttention(workspaceNodes)
    categories.push({
      key,
      label: key,
      expanded: true,
      containsCurrent: workspaceNodes.some(workspace => workspace.containsCurrent),
      workspaces: workspaceNodes,
      ...(attention === undefined ? {} : { attention }),
    })
  }

  const topLevelById = new Map(topLevelWorkspaces.map(workspace => [workspace.workspaceId as string, workspace]))
  const topLevel = orderedWorkspaceIds(manual, TOP_LEVEL_ORDER_KEY, [...topLevelById.keys()])
    .flatMap(workspaceId => {
      const workspace = topLevelById.get(workspaceId)
      return workspace === undefined ? [] : [workspaceNode(workspace)]
    })

  return { categories, topLevel, counts }
}

/** Apply expansion state without rescanning or rebuilding session summaries. */
export function projectTreeExpansion(tree: WorkspaceTree, view: GroupsTreeView): WorkspaceTree {
  const expandedCategories = new Set(view.expandedCategories)
  const expandedWorkspaces = new Set(view.expandedWorkspaces)
  const projectWorkspace = (workspace: WorkspaceGroupNode): WorkspaceGroupNode => {
    const expanded = expandedWorkspaces.has(workspace.workspaceId as string)
    return {
      ...workspace,
      expanded,
      sessions: expanded ? workspace.sessions : [],
    }
  }
  return {
    categories: tree.categories.map(category => ({
      ...category,
      expanded: expandedCategories.has(category.key),
      workspaces: category.workspaces.map(projectWorkspace),
    })),
    topLevel: tree.topLevel.map(projectWorkspace),
    counts: tree.counts,
  }
}

/** Derive grouped branches with the requested expansion state. */
export function deriveGroups(
  list: SessionListState,
  workspaces: readonly WorkspaceView[],
  archivedSessionIds: readonly SessionId[],
  config: GroupsConfig,
  view: GroupsTreeView,
  manual: ManualGroups,
): CategoryNode[] {
  return [...projectTreeExpansion(
    deriveWorkspaceTree(list, workspaces, archivedSessionIds, config, manual),
    view,
  ).categories]
}

/** Derive top-level branches with the requested expansion state. */
export function deriveTopLevel(
  list: SessionListState,
  workspaces: readonly WorkspaceView[],
  archivedSessionIds: readonly SessionId[],
  config: GroupsConfig,
  view: GroupsTreeView,
  manual: ManualGroups,
): WorkspaceGroupNode[] {
  return [...projectTreeExpansion(
    deriveWorkspaceTree(list, workspaces, archivedSessionIds, config, manual),
    view,
  ).topLevel]
}
