/**
 * Three-level tree search matching and pruned search tree derivation.
 */
import {
  indexSubagentDescendants,
  type SessionId,
  type SessionListState,
  type SessionSearchResultItem,
  type SessionSummary,
  type WorkspaceView,
} from '@deepseek-ai/dsh-client-runtime/client'
import { effectiveCategories, resolveCategory } from '../core/matcher.ts'
import type { GroupsConfig, ManualGroups } from '../core/types.ts'
import {
  sessionNode,
  sessionTitle,
  sessionVisible,
  workspaceLabel,
  type CategoryNode,
  type SessionNode,
  type WorkspaceGroupNode,
} from './tree.ts'

/** Recency comparator: newest first, id as the deterministic tiebreak. */
export function byRecency(a: SessionSummary, b: SessionSummary): number {
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

  const effective = effectiveCategories(config, manual)
  const categoryKeys = effective.map(e => e.key)
  const validCategoryKeys = new Set(categoryKeys)
  const byCategory = new Map<string, WorkspaceGroupNode[]>()
  for (const key of categoryKeys) byCategory.set(key, [])

  const topLevel: WorkspaceGroupNode[] = []
  for (const workspace of workspaces) {
    // Only sessions that matched the query and are visible in this folder.
    const pinnedIds = manual.pinnedSessions?.[workspace.workspaceId]
    const pinnedSet = new Set(pinnedIds ?? [])
    const matchedMap = new Map<SessionId, SessionNode>()

    for (const id of workspace.sessionIds) {
      const summary = list.byId[id]
      if (summary === undefined || !matchedIds.has(id)) continue
      if (!sessionVisible(summary, list.current, archived)) continue
      const isPinned = pinnedSet.has(id)
      const node = sessionNode(summary, descendants, isPinned, manual.colors?.[id])
      const snippet = snippetsBySession?.get(id)
      matchedMap.set(id, {
        ...node,
        matched: true,
        ...(snippet === undefined ? {} : { snippet }),
      })
    }
    if (matchedMap.size === 0) continue

    const nodes: SessionNode[] = []
    if (pinnedIds !== undefined) {
      for (const id of pinnedIds) {
        const node = matchedMap.get(id as SessionId)
        if (node !== undefined) nodes.push(node)
      }
    }
    for (const id of workspace.sessionIds) {
      if (pinnedSet.has(id)) continue
      const node = matchedMap.get(id)
      if (node !== undefined) nodes.push(node)
    }

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
    const key = resolveCategory(config, manual, workspace.workspaceId, workspace.path, workspace.title, validCategoryKeys)
    if (key === undefined) {
      topLevel.push(node)
      continue
    }
    if (!byCategory.has(key)) byCategory.set(key, [])
    byCategory.get(key)!.push(node)
  }

  const categories: CategoryNode[] = []
  // Same display order as the idle tree.
  for (const key of categoryKeys) {
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
