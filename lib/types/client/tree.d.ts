/**
 * Derives the three-level workspace-groups tree: 分类文件夹 → 项目文件夹 →
 * 会话行. Pure derivation — all inputs are snapshots; the renderer never
 * scans. Session visibility rules mirror the official ui-workspace tree
 * (blank rows only when current, archived excluded, subagent rows excluded).
 */
import { type PendingInteractionStatus, type SessionId, type SessionListState, type SessionSearchResultItem, type WorkspaceId, type WorkspaceView } from '@deepseek-ai/dsh-client-runtime/client';
import { type GroupsConfig, type ManualGroups } from '../core/types.ts';
/** One top-level session row inside a workspace folder. */
export interface SessionNode {
    id: SessionId;
    /** Stored display title; blank rows show the localized New Session label. */
    title: string;
    /** The provisional blank session (renderer shows the localized New Session title). */
    blank: boolean;
    pendingInteraction?: PendingInteractionStatus;
    running: boolean;
    /** Running descendants connected through uninterrupted subagent-origin lineage. */
    runningSubagentCount: number;
    /** Finished running while not selected and not yet opened (the green "done" reminder dot). */
    completed: boolean;
    updatedAt: number;
    /** Search-hit marker (rendered with a highlighted tint in search mode). */
    matched?: boolean;
    /** Content-match snippet from the Host search (search mode only). */
    snippet?: string;
}
/** One workspace folder row inside a category folder. */
export interface WorkspaceGroupNode {
    workspaceId: WorkspaceId;
    /** Canonical host directory path. */
    path: string;
    /** Display title. */
    label: string;
    /** Workspace creation time (epoch ms). */
    createdAt: number;
    /** Total visible sessions in the folder. */
    sessionCount: number;
    expanded: boolean;
    /** The folder contains the selected session (active folder tint). */
    containsCurrent: boolean;
    /** Visible session rows (empty while the folder is folded). */
    sessions: readonly SessionNode[];
}
/** One category folder at the top of the tree. */
export interface CategoryNode {
    /** Stable category key: the configured label, or the uncategorized bucket. */
    key: string;
    /** Display label. */
    label: string;
    expanded: boolean;
    /** The category contains the selected session (active folder tint). */
    containsCurrent: boolean;
    /** Workspace folders in host order. */
    workspaces: readonly WorkspaceGroupNode[];
}
/** Viewing state consumed by the derivation. */
export interface GroupsTreeView {
    expandedCategories: readonly string[];
    expandedWorkspaces: readonly string[];
}
/** Key of the uncategorized bucket (matches the config fallback label). */
export declare const UNCATEGORIZED_KEY = "\u672A\u5206\u7C7B";
/** Directory display label: basename of the path (both separators accepted). */
export declare function workspaceLabel(cwd: string | undefined): string;
/**
 * Derive the three-level tree.
 * @param list - sessions list snapshot (`current` feeds containsCurrent).
 * @param workspaces - real workspaces in stable Host order.
 * @param archivedSessionIds - registry-global archive set.
 * @param config - sidecar grouping config (rule categories).
 * @param view - local expansion arrays.
 * @param manual - runtime overlay (manual groups + overrides). A workspace's
 * manual override wins over rule classification; removing it reverts to rules.
 * @returns category sections in render order (rule categories first, then
 * manual-only ones, uncategorized last). Manual groups render even while
 * empty; empty rule buckets stay hidden.
 */
export declare function deriveGroups(list: SessionListState, workspaces: readonly WorkspaceView[], archivedSessionIds: readonly SessionId[], config: GroupsConfig, view: GroupsTreeView, manual: ManualGroups): CategoryNode[];
/**
 * While a drag is in progress, the empty uncategorized bucket must still
 * render as a drop target — otherwise a project can never be dragged OUT of a
 * group when every project is grouped (the bucket hides when empty). Appends
 * a collapsed empty uncategorized node when the bucket is absent; never
 * duplicates an existing one. Pure; the caller decides when a drag is active.
 */
export declare function withDraggingUncategorized(groups: readonly CategoryNode[], dragging: boolean): readonly CategoryNode[];
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
/**
 * Build a three-level search tree containing ONLY the branches that hold a
 * matched session: 分类文件夹 → 项目文件夹 → 命中会话行. Every matched
 * session carries `matched: true` so rows render with the search-hit tint.
 * Classification uses the same precedence as the idle tree (manual override →
 * rules), so search shows the same grouping the user sees.
 *
 * @param list - sessions list snapshot.
 * @param workspaces - real workspaces in stable Host order.
 * @param config - sidecar grouping config.
 * @param matchedIds - set of session ids that matched the query.
 * @param archivedSessionIds - registry-global archive set.
 * @param manual - runtime overlay (manual groups + overrides).
 * @param snippetsBySession - optional content-match snippets keyed by session id.
 * @returns categories in render order, pruned to matched branches only.
 */
export declare function deriveSearchGroups(list: SessionListState, workspaces: readonly WorkspaceView[], config: GroupsConfig, matchedIds: ReadonlySet<SessionId>, archivedSessionIds: readonly SessionId[], manual: ManualGroups, snippetsBySession?: ReadonlyMap<SessionId, string>): CategoryNode[];
