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
  state.categoryExpansion = Object.fromEntries(
    Object.entries(state.categoryExpansion).filter(([key]) => categoryKeys.includes(key)),
  )
  state.workspaceExpansion = Object.fromEntries(
    Object.entries(state.workspaceExpansion).filter(([key]) => workspaceKeys.includes(key)),
  )
}
