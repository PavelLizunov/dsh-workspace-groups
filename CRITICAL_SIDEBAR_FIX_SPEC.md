# Spec: Critical Sidebar Interaction Fixes

## 1. Intent & Invariants
- Restore Add Workspace, reliable collapse, safe Group reordering, and Workspace move-by-menu.
- Add Workspace uses a local browse dialog backed by official `listDirectory`, `createDirectory`, and `createWorkspace`; direct `pickDirectory()` is forbidden.
- Group/Workspace click and Enter/Space always toggle expansion.
- A Group row is not draggable; only `data-wg-drag-handle="category"` starts Group reorder.
- Drag restoration may undo only temporary drag folding and must never overwrite a later user toggle.
- Workspace `…` exposes a `Move to group` submenu with all effective groups and Top level, using the existing `moveWorkspaceTo` path.
- No operation moves filesystem directories.
- Active Web is not restarted in this batch.

## 2. Interface / Data Contract
```ts
type GroupsBrowserInjected = {
  listDirectory(path?: string, signal?: AbortSignal): Promise<DirectoryListing>
  createDirectory(parentPath: string, name: string): Promise<string>
  createWorkspace(input: { path: string }): Promise<WorkspaceView>
}

interface WorkspaceMoveTarget {
  key: string
  label: string
  current: boolean
}
```

The only Group drag source is `data-wg-drag-handle="category"`. Existing DnD payloads, drop selectors, overlay storage, and Workspace registration contracts remain stable.

## 3. Verification Checklist
- [x] Regression contracts forbid `pickDirectory()` and whole-row Group drag.
- [x] Cover Group/Workspace click and Enter/Space collapse contracts.
- [x] Cover temporary drag collapse/restore and stale snapshot protection.
- [x] Cover browse navigation, Cancel, Retry, and async-generation guards.
- [x] Cover Move-to-group submenu state and shared `moveWorkspaceTo` path.
- [x] Gemini swarm prepared file-disjoint contracts/handle work; lead integrated after the second swarm run failed technically.
- [x] Independent Sol review checked async races, expansion restoration, accessibility, path safety, submenu state, DnD propagation, and effective ordering; it found one medium caller-order defect.
- [x] Fixed the effective-order finding and completed a second Sol verification pass with no blocker/high findings; remaining medium ARIA-tree/test-depth risks stay in the accessibility plan.
- [x] `pnpm typecheck`, `pnpm test`, and `pnpm build` pass.
- [x] Generated `lib/` is updated.
- [x] Commit and push to `origin/main` without restarting Web.
