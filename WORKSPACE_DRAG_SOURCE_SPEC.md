# Spec: Stable Workspace Drag and Viewport-Safe Colors

## 1. Intent & Invariants
- Every grouped and top-level Workspace exposes an explicit name-and-icon drag surface.
- Native dragstart never mutates expansion or moves rows under the pointer.
- Project and Group expansion stays unchanged throughout drag-and-drop.
- Color choices use a flat portal menu that is clamped to the viewport and scrolls when needed.
- Action buttons do not start a drag; Search rows remain non-draggable.
- Active Web is not restarted without a separate explicit user confirmation.

## 2. Interface / Data Contract
```tsx
onWorkspaceDragStart(workspaceId, event) {
  setDragging('workspace')
}

<ColorMenu value={color} onSelect={onSetColor} />
```

## 3. Verification Checklist
- [x] Grouped and top-level Workspace rows expose independent drag sources.
- [x] Dragstart leaves Group and Workspace expansion unchanged.
- [x] Browser verifier targets the actual Workspace drag surface.
- [x] Color choices use a flat compact portal menu rather than a nested submenu.
- [x] Browser verifier checks the color menu in a 320x320 viewport.
- [x] `pnpm build && pnpm verify` passes.
- [x] Commit and push to `origin/main` without restarting Web.
