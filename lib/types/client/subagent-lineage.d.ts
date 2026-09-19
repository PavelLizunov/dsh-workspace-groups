/** Workspace-groups-owned projection of uninterrupted subagent descendants. */
import type { SessionId } from '@deepseek-ai/dsh-session/types';
import type { SessionSummary } from '@deepseek-ai/dsh-api-session-controller/client';
export interface SubagentDescendantSummary {
    readonly count: number;
    readonly runningCount: number;
}
/** Count descendants through subagent-only lineage, stopping at missing parents or cycles. */
export declare function indexSubagentDescendants(summaries: Readonly<Record<SessionId, SessionSummary>>): ReadonlyMap<SessionId, SubagentDescendantSummary>;
