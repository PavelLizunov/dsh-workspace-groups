# Spec: Every Workspace Is a Drag Source

## 1. Intent & Invariants
- Every grouped and top-level Workspace row exposes an explicit name-and-icon drag surface.
- Dragging the name or icon uses that row's Workspace ID, regardless of position.
- Action buttons do not start a drag; Search rows remain non-draggable.
- Existing reorder, move-to-group, move-out, click, and keyboard behavior remains intact.
- Active Web is not restarted in this batch.

## 2. Interface / Data Contract
```ts
interface WorkspaceRowDragProps {
  draggable?: boolean
  onWorkspaceDragStart?: (
    workspaceId: WorkspaceId,
    event: DragEvent
  ) => void
}
```

## 3. Verification Checklist
- [x] Grouped and top-level production rows explicitly enable dragging.
- [x] First, middle, and last Workspace rows expose independent drag sources.
- [x] Dragging the middle row writes its own ID to `DND_WORKSPACE_TYPE`.
- [x] Action buttons remain non-draggable.
- [x] `pnpm build && pnpm verify` passes.
- [x] Commit and push to `origin/main`.
