import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'

export const SESSION_ROW_LIMIT = 5

/** First five sessions, plus the selected, pinned, or color-tagged sessions when they fall outside that window. */
export function visibleWorkspaceSessions<T extends { id: SessionId; pinned?: boolean; color?: string | null }>(
  sessions: readonly T[],
  currentId: SessionId | undefined,
  showAll: boolean,
): readonly T[] {
  if (showAll || sessions.length <= SESSION_ROW_LIMIT) return sessions
  return sessions.filter((session, index) => (
    session.pinned === true
    || (typeof session.color === 'string' && session.color !== '')
    || index < SESSION_ROW_LIMIT
    || session.id === currentId
  ))
}
