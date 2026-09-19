/**
 * Three-level tree search matching and pruned search tree derivation.
 */
import type { SessionId } from '@deepseek-ai/dsh-session/types';
import type { SessionListState, SessionSearchResultItem, SessionSummary } from '@deepseek-ai/dsh-api-session-controller/client';
import type { WorkspaceView } from '@deepseek-ai/dsh-api-workspace-controller/client';
import type { SessionPendingInteractionSnapshot } from '@deepseek-ai/dsh-client-ui-session/client';
import type { GroupsConfig, ManualGroups } from '../core/types.js';
import { type CategoryNode, type WorkspaceGroupNode } from './tree.js';
/** Recency comparator: newest first, id as the deterministic tiebreak. */
export declare function byRecency(a: SessionSummary, b: SessionSummary): number;
/** Bounded set of matched sessions plus content snippets (feeds the search tree). */
export interface SearchMatchSet {
    /** Session ids that matched (local metadata hits + Host content hits). */
    matchedIds: ReadonlySet<SessionId>;
    /** Content-match snippets keyed by session id (Host search only). */
    snippetsBySession: ReadonlyMap<SessionId, string>;
    hasMore: boolean;
}
/**
 * Compute the matched-session set: immediate title/Workspace substring matches
 * from the local list, merged with ranked Host content matches. The consumer
 * (SearchBody) derives the pruned three-level tree from these ids.
 */
export declare function deriveSearchMatches(list: SessionListState, workspaces: readonly WorkspaceView[], config: GroupsConfig, query: string, archivedSessionIds: readonly SessionId[], content: {
    items: readonly SessionSearchResultItem[];
    hasMore: boolean;
}, limit: number): SearchMatchSet;
/** Search tree: group folders plus top-level (ungrouped) matched workspaces. */
export interface SearchTree {
    /** Group folders containing matched sessions, in display order. */
    categories: CategoryNode[];
    /** Top-level (ungrouped) workspaces holding matched sessions. */
    topLevel: WorkspaceGroupNode[];
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
export declare function deriveSearchGroups(list: SessionListState, workspaces: readonly WorkspaceView[], config: GroupsConfig, matchedIds: ReadonlySet<SessionId>, archivedSessionIds: readonly SessionId[], manual: ManualGroups, snippetsBySession?: ReadonlyMap<SessionId, string>, pendingInteractions?: SessionPendingInteractionSnapshot): SearchTree;
