# Spec: Rail Mode and Reliable DnD Repair

## 1. Intent & Invariants
- Collapsed sidebar renders only Add Workspace and Search controls, never the Group/Workspace/Session tree.
- New Group is wide-only; rail Search expands the sidebar.
- Only `data-wg-drag-handle="category"` starts Group reorder, with Blink/WebKit-safe native dragging.
- Group drag does not synchronously fold groups or shift layout.
- A visible append target after the last Group accepts category drops.
- Moving Workspace from top level into a Group removes stale `workspaceOrder[__topLevel__]` entries.
- Verifier uses the actual handle, asserts MIME payload, and verifies real before/after order.
- No filesystem directory or Host registration order is changed.
- Active Web is not restarted in this batch.

## 2. Interface / Data Contract
```tsx
wide === false => no wgTreeBody / wgList / CategorySection

data-wg-drag-handle="category"
data-wg-category-drop-end="true"

export const DND_CATEGORY_TYPE =
  'application/x-dsh-workspace-groups-category'
```

## 3. Verification Checklist
- [x] Rail tree content is gated behind `wide`.
- [x] New Group is wide-only; Add Workspace and rail Search remain.
- [x] Group handle is WebKit-safe and isolated from row toggle.
- [x] Group drag does not fold groups.
- [x] Bottom append target is visible during Group drag.
- [x] Top-level order is cleaned when Workspace moves to a Group.
- [x] CDP verifier targets the handle, checks MIME, relative order, append, and stable expansion.
- [x] Gemini swarm completed file-disjoint implementation and tests.
- [x] Independent Sol review returned PASS with no blocker/high findings.
- [x] Final `typecheck`, tests, build, syntax, and generated artifacts pass.
- [x] Commit and push to `origin/main`.
