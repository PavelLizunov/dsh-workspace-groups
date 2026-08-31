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
  type SessionSearchResultItem,
  type SessionSummary,
  type SubagentDescendantSummary,
  type WorkspaceId,
  type WorkspaceView,
} from '@deepseek-ai/dsh-client-runtime/client'
import { readAttentionProjection, type SessionAttentionReason } from '../core/attention.ts'
import { effectiveCategories, orderedWorkspaceIds, resolveCategory } from '../core/matcher.ts'
import { TOP_LEVEL_ORDER_KEY, UNCATEGORIZED_LABEL, type GroupsConfig, type ManualGroups } from '../core/types.ts'

const UNKNOWN_WORKSPACE_LABEL = 'Unknown workspace'

export type AttentionState = 'error' | 'warning' | 'ongoing' | 'done'

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
  const base = cwd.replace(/[/\\]+$/, '').split(/[/\\]/).pop()
  return base !== undefined && base !== '' ? base : cwd
}

/** Ordinary sessions are visible; blank only when current; archived/subagent never. */
function sessionVisible(session: SessionSummary, current: SessionId | undefined, archived: ReadonlySet<SessionId>): boolean {
  return session.origin !== 'subagent'
    && !archived.has(session.id)
    && (!session.blank || session.id === current)
}

/** Blank rows display the localized New Session label (never enters search). */
function sessionTitle(session: SessionSummary): string {
  return session.blank ? 'New Session' : session.displayTitle
}

function sessionNode(
  s: SessionSummary,
  descendants: ReadonlyMap<SessionId, SubagentDescendantSummary>,
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
  }
}

/** Derive the attention state for a single session node. */
export function sessionAttention(
  node: Pick<SessionNode, 'pendingInteraction' | 'running' | 'runningSubagentCount' | 'completed' | 'projectionReason'>,
): AttentionState | undefined {
  if (
    node.projectionReason === 'error' ||
    node.projectionReason === 'interrupted' ||
    node.projectionReason === 'max-tokens'
  ) {
    return 'error'
  }
  if (
    node.pendingInteraction === 'approval' ||
    node.pendingInteraction === 'plan-review' ||
    node.pendingInteraction === 'question' ||
    node.projectionReason === 'awaiting-user'
  ) {
    return 'warning'
  }
  if (node.running || node.runningSubagentCount > 0) return 'ongoing'
  return node.completed ? 'done' : undefined
}

/** Aggregate attention state across session nodes with priority error > warning > ongoing > done. */
function aggregateAttention(nodes: readonly SessionNode[]): AttentionState | undefined {
  let hasWarning = false
  let hasOngoing = false
  let hasDone = false
  for (const node of nodes) {
    const state = sessionAttention(node)
    if (state === 'error') return 'error'
    if (state === 'warning') hasWarning = true
    else if (state === 'ongoing') hasOngoing = true
    else if (state === 'done') hasDone = true
  }
  if (hasWarning) return 'warning'
  if (hasOngoing) return 'ongoing'
  if (hasDone) return 'done'
  return undefined
}

/** Aggregate category attention across member workspace nodes with priority error > warning > ongoing > done. */
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

/** Visible sessions of one workspace in its stored account order. */
function workspaceSessions(
  list: SessionListState,
  workspace: WorkspaceView,
  archived: ReadonlySet<SessionId>,
  descendants: ReadonlyMap<SessionId, SubagentDescendantSummary>,
  onSession?: (session: SessionNode) => void,
): SessionNode[] {
  const nodes: SessionNode[] = []
  for (const id of workspace.sessionIds) {
    const summary = list.byId[id]
    if (summary === undefined) continue // account may lead the list pull; appears when the summary lands
    if (!sessionVisible(summary, list.current, archived)) continue
    const node = sessionNode(summary, descendants)
    nodes.push(node)
    onSession?.(node)
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
    const key = resolveCategory(config, manual, workspace.workspaceId, workspace.path, workspace.title)
    if (key === undefined) {
      topLevelWorkspaces.push(workspace)
      continue
    }
    if (!byCategory.has(key)) byCategory.set(key, [])
    byCategory.get(key)!.push(workspace)
  }

  const workspaceNode = (workspace: WorkspaceView): WorkspaceGroupNode => {
    const sessions = workspaceSessions(list, workspace, archived, descendants, countSession)
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

/** Recency comparator: newest first, id as the deterministic tiebreak. */
function byRecency(a: SessionSummary, b: SessionSummary): number {
  if (b.updatedAt !== a.updatedAt) return b.updatedAt - a.updatedAt
  return a.id < b.id ? -1 : 1
}

/** Bounded set of matched sessions plus content snippets (feeds the search tree). */
export interface SearchMatchSet {
  /** Session ids that matched (local metadata hits + Host content hits). */
  matchedIds: ReadonlySet<SessionId>
  /** Content-match snippets keyed by session id (Host search only). */
  snippetsBySession: ReadonlyMap<SessionId, string>
  hasMore: boolean
}

/**
 * Compute the matched-session set: immediate title/Workspace substring matches
 * from the local list, merged with ranked Host content matches. The consumer
 * (SearchBody) derives the pruned three-level tree from these ids.
 */
export function deriveSearchMatches(
  list: SessionListState,
  workspaces: readonly WorkspaceView[],
  config: GroupsConfig,
  query: string,
  archivedSessionIds: readonly SessionId[],
  content: { items: readonly SessionSearchResultItem[]; hasMore: boolean },
  limit: number,
): SearchMatchSet {
  const q = query.trim().toLowerCase()
  if (q === '') return { matchedIds: new Set(), snippetsBySession: new Map(), hasMore: false }
  const archived = new Set(archivedSessionIds)

  const workspaceBySession = new Map<SessionId, WorkspaceView>()
  for (const workspace of workspaces) {
    for (const sessionId of workspace.sessionIds) {
      if (!workspaceBySession.has(sessionId)) workspaceBySession.set(sessionId, workspace)
    }
  }
  const labelOf = (summary: SessionSummary): string =>
    workspaceBySession.get(summary.id)?.title ?? workspaceLabel(summary.cwd)

  const local: SessionSummary[] = []
  for (const id of list.ids) {
    const summary = list.byId[id]
    if (summary === undefined || summary.blank || !sessionVisible(summary, list.current, archived)) continue
    if (
      sessionTitle(summary).toLowerCase().includes(q)
      || labelOf(summary).toLowerCase().includes(q)
    ) {
      local.push(summary)
    }
  }
  local.sort(byRecency)

  const ordered: SessionSummary[] = []
  const included = new Set<SessionId>()
  const include = (summary: SessionSummary): void => {
    if (included.has(summary.id)) return
    included.add(summary.id)
    ordered.push(summary)
  }
  for (const summary of local) include(summary)
  for (const item of content.items) {
    const summary = list.byId[item.sessionId]
    if (summary !== undefined && !summary.blank && sessionVisible(summary, list.current, archived)) include(summary)
  }

  const snippets = new Map<SessionId, string>()
  for (const item of content.items) {
    if (item.snippet !== undefined) snippets.set(item.sessionId, item.snippet)
  }

  return {
    matchedIds: ordered.slice(0, limit).reduce((set, summary) => { set.add(summary.id); return set }, new Set<SessionId>()),
    snippetsBySession: snippets,
    hasMore: content.hasMore || ordered.length > limit,
  }
}

/** Search tree: group folders plus top-level (ungrouped) matched workspaces. */
export interface SearchTree {
  /** Group folders containing matched sessions, in display order. */
  categories: CategoryNode[]
  /** Top-level (ungrouped) workspaces holding matched sessions. */
  topLevel: WorkspaceGroupNode[]
}

/**
 * Build a three-level search tree containing ONLY the branches that hold a
 * matched session: category folder → workspace folder → matched session row. Every matched
 * session carries `matched: true` so rows render with the search-hit tint.
 * Classification uses the same precedence as the idle tree (manual override →
 * rules), so search shows the same grouping the user sees. Matched top-level
 * workspaces are returned separately (rendered as plain rows).
 *
 * @param list - sessions list snapshot.
 * @param workspaces - real workspaces in stable Host order.
 * @param config - sidecar grouping config.
 * @param matchedIds - set of session ids that matched the query.
 * @param archivedSessionIds - registry-global archive set.
 * @param manual - runtime overlay (manual groups + overrides).
 * @param snippetsBySession - optional content-match snippets keyed by session id.
 * @returns group folders in render order plus top-level matched workspaces,
 * pruned to matched branches only.
 */
export function deriveSearchGroups(
  list: SessionListState,
  workspaces: readonly WorkspaceView[],
  config: GroupsConfig,
  matchedIds: ReadonlySet<SessionId>,
  archivedSessionIds: readonly SessionId[],
  manual: ManualGroups,
  snippetsBySession?: ReadonlyMap<SessionId, string>,
): SearchTree {
  const archived = new Set(archivedSessionIds)
  const descendants = indexSubagentDescendants(list.byId)

  const byCategory = new Map<string, WorkspaceGroupNode[]>()
  for (const key of effectiveCategories(config, manual).map(e => e.key)) byCategory.set(key, [])

  const topLevel: WorkspaceGroupNode[] = []
  for (const workspace of workspaces) {
    // Only sessions that matched the query and are visible in this folder.
    const nodes: SessionNode[] = []
    for (const id of workspace.sessionIds) {
      const summary = list.byId[id]
      if (summary === undefined || !matchedIds.has(id)) continue
      if (!sessionVisible(summary, list.current, archived)) continue
      const node = sessionNode(summary, descendants)
      const snippet = snippetsBySession?.get(id)
      nodes.push({
        ...node,
        matched: true,
        ...(snippet === undefined ? {} : { snippet }),
      })
    }
    if (nodes.length === 0) continue

    const node: WorkspaceGroupNode = {
      workspaceId: workspace.workspaceId,
      path: workspace.path,
      label: workspace.title,
      createdAt: Date.parse(workspace.createdAt),
      sessionCount: nodes.length,
      expanded: true,
      containsCurrent: false,
      sessions: nodes,
    }
    const key = resolveCategory(config, manual, workspace.workspaceId, workspace.path, workspace.title)
    if (key === undefined) {
      topLevel.push(node)
      continue
    }
    if (!byCategory.has(key)) byCategory.set(key, [])
    byCategory.get(key)!.push(node)
  }

  const categories: CategoryNode[] = []
  // Same display order as the idle tree.
  for (const key of effectiveCategories(config, manual).map(e => e.key)) {
    const workspaceNodes = byCategory.get(key)
    if (workspaceNodes === undefined || workspaceNodes.length === 0) continue
    categories.push({
      key,
      label: key,
      expanded: true,
      containsCurrent: false,
      workspaces: workspaceNodes,
    })
  }
  return { categories, topLevel }
}
