import type { SessionId, SessionSummary } from '@deepseek-ai/dsh-client-runtime/client'

export const DEFAULT_CLEANUP_DAYS = 30
export const CLEANUP_DAYS_PRESETS = [7, 14, 30, 60, 90] as const

export interface CleanupFilterOptions {
  days: number
  now: number
  currentSessionId?: SessionId | undefined
  archivedSessionIds: readonly SessionId[]
  targetWorkspaceSessionIds?: readonly SessionId[] | undefined
}

/**
 * Filter sessions eligible for archiving based on inactivity threshold.
 * Excludes running sessions, pending interactions, blank sessions,
 * the current active session, subagent children, and already archived sessions.
 */
export function findOldSessionsToArchive(
  sessions: readonly SessionSummary[],
  options: CleanupFilterOptions,
): SessionSummary[] {
  const { days, now, currentSessionId, archivedSessionIds, targetWorkspaceSessionIds } = options
  const cutoff = now - Math.max(1, days) * 24 * 60 * 60 * 1000
  const archivedSet = new Set(archivedSessionIds)
  const workspaceSet = targetWorkspaceSessionIds ? new Set(targetWorkspaceSessionIds) : null

  return sessions.filter(session => {
    if (session.origin === 'subagent') return false
    if (session.blank) return false
    if (session.running) return false
    if (session.pendingInteraction !== undefined) return false
    if (currentSessionId !== undefined && session.id === currentSessionId) return false
    if (archivedSet.has(session.id)) return false
    if (workspaceSet !== null && !workspaceSet.has(session.id)) return false
    return session.updatedAt < cutoff
  }).sort((a, b) => a.updatedAt - b.updatedAt)
}
