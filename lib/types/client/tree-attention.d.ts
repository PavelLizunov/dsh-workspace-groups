/**
 * Attention derivation and aggregation for sessions, workspaces, and categories.
 * Priority hierarchy: error > warning > ongoing > done.
 */
/** Navigation presentation recognizes the three built-in pending interaction kinds. */
export type PendingInteractionStatus = 'approval' | 'plan-review' | 'question';
import type { SessionAttentionReason } from '../core/attention.js';
export type AttentionState = 'error' | 'warning' | 'ongoing' | 'done';
/** Minimal fields needed to derive a session's attention badge. */
export interface SessionAttentionInput {
    pendingInteraction?: PendingInteractionStatus;
    running: boolean;
    runningSubagentCount: number;
    completed: boolean;
    projectionReason?: SessionAttentionReason;
}
/** Minimal fields needed to aggregate a workspace's attention badge. */
export interface WorkspaceAttentionInput {
    attention?: AttentionState;
}
/** Derive the attention state for a single session node. */
export declare function sessionAttention(node: SessionAttentionInput): AttentionState | undefined;
/** Aggregate attention state across session nodes with priority error > warning > ongoing > done. */
export declare function aggregateAttention(nodes: readonly SessionAttentionInput[]): AttentionState | undefined;
/** Aggregate category attention across member workspace nodes with priority error > warning > ongoing > done. */
export declare function aggregateCategoryAttention(workspaces: readonly WorkspaceAttentionInput[]): AttentionState | undefined;
