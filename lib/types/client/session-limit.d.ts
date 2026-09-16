import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client';
export declare const SESSION_ROW_LIMIT = 5;
/** First five sessions, plus the selected, pinned, or color-tagged sessions when they fall outside that window. */
export declare function visibleWorkspaceSessions<T extends {
    id: SessionId;
    pinned?: boolean;
    color?: string | null;
}>(sessions: readonly T[], currentId: SessionId | undefined, showAll: boolean): readonly T[];
