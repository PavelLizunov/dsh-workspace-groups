/**
 * Pure expansion-state transforms for the workspace-groups store. Kept free
 * of any runtime import so both the store (which binds them via defineStore)
 * and unit tests (which exercise them directly) share one implementation.
 *
 * Expansion semantics follow the official ui-workspace store: collapse
 * WRITES `false` (never deletes the key). The browser's auto-expand guard
 * uses `Object.hasOwn` — a present `false` means "user deliberately
 * collapsed this" and must NOT be re-expanded; only a fully absent key means
 * "never touched" and may auto-expand. (Earlier versions deleted the key on
 * collapse, which made the current category/workspace impossible to fold.)
 */

/** Workspace-groups browser viewing state persisted across surface remounts and reloads. */
export interface GroupsViewState {
  /** Category folder expansion keyed by category label (absent = never touched). */
  categoryExpansion: Record<string, boolean>
  /** Workspace folder expansion keyed by workspace id (absent = never touched). */
  workspaceExpansion: Record<string, boolean>
  /** Unread completed session reminders keyed by session id (survives page reloads). */
  completedSessions?: Record<string, boolean>
  /** Last-observed running sessions keyed by session id (catches turns finishing during reload). */
  runningSessions?: Record<string, boolean>
  /** Viewed terminal error revisions, independent of the durable Host projection. */
  acknowledgedErrors?: Record<string, string>
}

export interface SessionCompletionObservation {
  id: string
  running: boolean
  completed: boolean
  errorRevision?: string
}

export interface ExpansionSnapshot {
  categories: Record<string, boolean>
  workspaces: Record<string, boolean>
}

/** Collapse writes `false` (key retained); expand writes `true`. */
export function setCategoryExpandedImpl(state: GroupsViewState, key: string, expanded: boolean): void {
  state.categoryExpansion[key] = expanded
}

/** Collapse writes `false` (key retained); expand writes `true`. */
export function setWorkspaceExpandedImpl(state: GroupsViewState, key: string, expanded: boolean): void {
  state.workspaceExpansion[key] = expanded
}

/** Set many category folders in one store action while preserving unrelated keys. */
export function setCategoriesExpandedImpl(state: GroupsViewState, keys: readonly string[], expanded: boolean): void {
  for (const key of keys) state.categoryExpansion[key] = expanded
}

/** Set many workspace folders in one store action while preserving unrelated keys. */
export function setWorkspacesExpandedImpl(state: GroupsViewState, keys: readonly string[], expanded: boolean): void {
  for (const key of keys) state.workspaceExpansion[key] = expanded
}

/** Snapshot current expansion state before temporary drag folding. */
export function captureExpansionSnapshot(state: GroupsViewState): ExpansionSnapshot {
  return {
    categories: { ...state.categoryExpansion },
    workspaces: { ...state.workspaceExpansion },
  }
}

/** Restore temporary drag folding while preserving keys the user toggled during the drag. */
export function restoreExpansionSnapshotImpl(
  state: GroupsViewState,
  snapshot: ExpansionSnapshot,
  touchedCategories: readonly string[],
  touchedWorkspaces: readonly string[],
): void {
  const categoryTouches = new Set(touchedCategories)
  const workspaceTouches = new Set(touchedWorkspaces)
  for (const [key, value] of Object.entries(snapshot.categories)) {
    if (!categoryTouches.has(key)) state.categoryExpansion[key] = value
  }
  for (const [key, value] of Object.entries(snapshot.workspaces)) {
    if (!workspaceTouches.has(key)) state.workspaceExpansion[key] = value
  }
}

/** Drop expansion keys that no longer exist (renames/deletes/config edits). */
export function retainKeysImpl(
  state: GroupsViewState,
  categoryKeys: readonly string[],
  workspaceKeys: readonly string[],
): void {
  const allowedCategories = new Set(categoryKeys)
  const allowedWorkspaces = new Set(workspaceKeys)
  state.categoryExpansion = Object.fromEntries(
    Object.entries(state.categoryExpansion).filter(([key]) => allowedCategories.has(key)),
  )
  state.workspaceExpansion = Object.fromEntries(
    Object.entries(state.workspaceExpansion).filter(([key]) => allowedWorkspaces.has(key)),
  )
}

function sameBooleanMap(a: Record<string, boolean> | undefined, b: Record<string, boolean>): boolean {
  const left = a ?? {}
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(b)
  if (leftKeys.length !== rightKeys.length) return false
  for (const key of rightKeys) {
    if (left[key] !== b[key]) return false
  }
  return true
}

/** Clear one session's persisted completion reminder when opened/selected. */
export function clearCompletedSessionImpl(state: GroupsViewState, sessionId: string): void {
  if (state.completedSessions?.[sessionId] !== true) return
  const next = { ...state.completedSessions }
  delete next[sessionId]
  state.completedSessions = next
}

/**
 * Reconcile persisted unread-completion reminders and running-session tracking
 * against a ready session list snapshot. Preserves unread completion across
 * page reloads and promotes sessions that were running before reload and
 * finished before the reloaded list arrived. Also acknowledges the current
 * terminal error revision and drops acknowledgments for removed/changed errors.
 */
export function reconcileSessionCompletionImpl(
  state: GroupsViewState,
  sessions: readonly SessionCompletionObservation[],
  currentSessionId?: string,
): void {
  const prevCompleted = state.completedSessions ?? {}
  const prevRunning = state.runningSessions ?? {}
  const nextCompleted: Record<string, boolean> = {}
  const nextRunning: Record<string, boolean> = {}
  const prevErrors = state.acknowledgedErrors ?? {}
  const nextErrors: Record<string, string> = {}

  for (const session of sessions) {
    if (session.errorRevision !== undefined && (
      session.id === currentSessionId || prevErrors[session.id] === session.errorRevision
    )) {
      nextErrors[session.id] = session.errorRevision
    }
    if (session.running) {
      nextRunning[session.id] = true
      continue
    }
    if (session.id === currentSessionId || nextErrors[session.id] !== undefined) continue
    if (prevCompleted[session.id] === true || session.completed || prevRunning[session.id] === true) {
      nextCompleted[session.id] = true
    }
  }

  if (Object.keys(prevErrors).length !== Object.keys(nextErrors).length
    || Object.keys(nextErrors).some(id => prevErrors[id] !== nextErrors[id])) {
    state.acknowledgedErrors = nextErrors
  }
  if (!sameBooleanMap(state.completedSessions, nextCompleted)) {
    state.completedSessions = nextCompleted
  }
  if (!sameBooleanMap(state.runningSessions, nextRunning)) {
    state.runningSessions = nextRunning
  }
}

