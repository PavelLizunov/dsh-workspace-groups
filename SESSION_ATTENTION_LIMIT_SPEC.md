# Spec: Aggregated Attention and Session Limit

## 1. Intent & Invariants
- Collapsed Group and Workspace rows expose the highest-priority child-session status.
- Priority is warning, then ongoing, then unviewed completion; expanded rows defer to their children.
- Expanded Workspaces show five sessions by default, plus the selected session when outside that window.
- Show all / Collapse is transient, applies to grouped and top-level Workspaces, and does not change total counts or search.
- Host APIs and persisted view state remain unchanged.
- Active Web is not restarted without separate explicit approval.

## 2. Interface / Data Contract
```ts
export type AttentionState = 'warning' | 'ongoing' | 'done'

interface CategoryNode { attention?: AttentionState }
interface WorkspaceGroupNode { attention?: AttentionState }

export const SESSION_ROW_LIMIT = 5
```

## 3. Verification Checklist
- [x] Group and Workspace attention aggregates all visible child sessions with the required priority.
- [x] Aggregate dots render only on collapsed rows and clear with the underlying session status.
- [x] Five sessions render by default; a selected session outside the window remains visible.
- [x] Show all / Collapse works through one shared grouped/top-level renderer.
- [x] Full session counts and search behavior remain unchanged.
- [x] `pnpm build && pnpm verify` passes.
- [x] Commit and push to `origin/main` without restarting Web.
