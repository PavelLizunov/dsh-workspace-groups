import type { SessionId } from '@deepseek-ai/dsh-session/types';
import type { SessionSummary } from '@deepseek-ai/dsh-api-session-controller/client';
import type { SessionPendingInteractionSnapshot } from '@deepseek-ai/dsh-client-ui-session/client';
export declare const DEFAULT_CLEANUP_DAYS = 30;
export declare const CLEANUP_DAYS_PRESETS: readonly [7, 14, 30, 60, 90];
export interface CleanupFilterOptions {
    pendingInteractions: SessionPendingInteractionSnapshot;
    days: number;
    now: number;
    currentSessionId?: SessionId | undefined;
    archivedSessionIds: readonly SessionId[];
    targetWorkspaceSessionIds?: readonly SessionId[] | undefined;
}
/**
 * Filter sessions eligible for archiving based on inactivity threshold.
 * Excludes running sessions, pending interactions, blank sessions,
 * the current active session, subagent children, and already archived sessions.
 */
export declare function findOldSessionsToArchive(sessions: readonly SessionSummary[], options: CleanupFilterOptions): SessionSummary[];
