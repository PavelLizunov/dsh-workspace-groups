/** Client-visible incremental attention folded from durable session events. */
export declare const ATTENTION_PROJECTION_KEY = "workspaceGroupsAttention";
export type SessionAttentionReason = 'awaiting-user' | 'error' | 'interrupted' | 'max-tokens' | null;
export interface WorkspaceGroupsAttentionProjection {
    reason: SessionAttentionReason;
}
export declare const EMPTY_ATTENTION_PROJECTION: WorkspaceGroupsAttentionProjection;
/** Exact approval footer emitted by the local SDD skill (Markdown emphasis is ignored). */
export declare function requestsSddApproval(content: readonly unknown[]): boolean;
/** Read the plugin projection from an untrusted SessionSummary projection map. */
export declare function readAttentionProjection(values: unknown): WorkspaceGroupsAttentionProjection;
