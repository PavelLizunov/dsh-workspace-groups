import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client';
export declare const SESSION_ROW_LIMIT = 5;
/** First five sessions, plus the selected session when it falls outside that window. */
export declare function visibleWorkspaceSessions<T extends {
    id: SessionId;
}>(sessions: readonly T[], currentId: SessionId | undefined, showAll: boolean): readonly T[];
