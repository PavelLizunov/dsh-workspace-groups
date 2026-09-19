/**
 * Derives the three-level workspace-groups tree: category folder → workspace folder →
 * session row. Pure derivation — all inputs are snapshots; the renderer never
 * scans. Session visibility rules mirror the official ui-workspace tree
 * (blank rows only when current, archived excluded, subagent rows excluded).
 */
import type { SessionId } from '@deepseek-ai/dsh-session/types';
import type { SessionListState, SessionSummary } from '@deepseek-ai/dsh-api-session-controller/client';
import type { WorkspaceId, WorkspaceView } from '@deepseek-ai/dsh-api-workspace-controller/client';
import type { SessionPendingInteractionSnapshot } from '@deepseek-ai/dsh-client-ui-session/client';
import { type SubagentDescendantSummary } from './subagent-lineage.js';
import type { PendingInteractionStatus } from './tree-attention.js';
import { type SessionAttentionReason } from '../core/attention.js';
import { type GroupsConfig, type ManualGroups } from '../core/types.js';
import { type AttentionState } from './tree-attention.js';
export type { AttentionState } from './tree-attention.js';
export { sessionAttention, aggregateAttention, aggregateCategoryAttention } from './tree-attention.js';
export type { SearchMatchSet, SearchTree } from './tree-search.js';
export { byRecency, deriveSearchMatches, deriveSearchGroups } from './tree-search.js';
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
    projectionReason?: SessionAttentionReason;
    /** True when the session is pinned to the top of its workspace. */
    pinned?: boolean;
    /** Color ping from the overlay (`manual.colors[sessionId]`). */
    color?: string;
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
    /** Aggregated child-session attention state for collapsed workspace rows. */
    attention?: AttentionState;
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
    /** Aggregated child-session attention state for collapsed category rows. */
    attention?: AttentionState;
}
/** Viewing state consumed by the derivation. */
export interface GroupsTreeView {
    expandedCategories: readonly string[];
    expandedWorkspaces: readonly string[];
}
/** Attention counts collected while building the canonical session nodes. */
export interface WorkspaceTreeCounts {
    all: number;
    warning: number;
    ongoing: number;
    done: number;
}
/** Fully populated grouped and top-level branches for one session snapshot. */
export interface WorkspaceTree {
    categories: readonly CategoryNode[];
    topLevel: readonly WorkspaceGroupNode[];
    counts: WorkspaceTreeCounts;
}
/** Key of the uncategorized bucket (matches the config fallback label). */
export declare const UNCATEGORIZED_KEY = "\u672A\u5206\u7C7B";
/** Directory display label: basename of the path (both separators accepted). */
export declare function workspaceLabel(cwd: string | undefined): string;
/** Ordinary sessions are visible; blank only when current; archived/subagent never. */
export declare function sessionVisible(session: SessionSummary, current: SessionId | undefined, archived: ReadonlySet<SessionId>): boolean;
/** Blank rows display the localized New Session label (never enters search). */
export declare function sessionTitle(session: SessionSummary): string;
export declare function sessionNode(s: SessionSummary, descendants: ReadonlyMap<SessionId, SubagentDescendantSummary>, pinned?: boolean, pendingInteractions?: SessionPendingInteractionSnapshot, color?: string | null): SessionNode;
/** Build the fully populated grouped and top-level tree once per list snapshot. */
export declare function deriveWorkspaceTree(list: SessionListState, workspaces: readonly WorkspaceView[], archivedSessionIds: readonly SessionId[], config: GroupsConfig, manual: ManualGroups, pendingInteractions?: SessionPendingInteractionSnapshot): WorkspaceTree;
/** Apply expansion state without rescanning or rebuilding session summaries. */
export declare function projectTreeExpansion(tree: WorkspaceTree, view: GroupsTreeView): WorkspaceTree;
/** Derive grouped branches with the requested expansion state. */
export declare function deriveGroups(list: SessionListState, workspaces: readonly WorkspaceView[], archivedSessionIds: readonly SessionId[], config: GroupsConfig, view: GroupsTreeView, manual: ManualGroups, pendingInteractions?: SessionPendingInteractionSnapshot): CategoryNode[];
/** Derive top-level branches with the requested expansion state. */
export declare function deriveTopLevel(list: SessionListState, workspaces: readonly WorkspaceView[], archivedSessionIds: readonly SessionId[], config: GroupsConfig, view: GroupsTreeView, manual: ManualGroups, pendingInteractions?: SessionPendingInteractionSnapshot): WorkspaceGroupNode[];
