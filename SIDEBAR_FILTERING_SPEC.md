# Spec: Finder-Style Sidebar Filtering

## 1. Intent & Invariants
- Add Finder-style client-side filtering: an always-visible status scope plus one color and one recency criterion.
- Status is exactly one of **All / Needs attention / Running / New**.
- A selected Group color includes that Group's workspaces; a selected Workspace color includes that Workspace.
- Text search, status, color, and recency combine with logical AND.
- Empty Group/Workspace branches are hidden; filtered branches keep the current expansion and remain controllable.
- Expansion changes made while filtering are transient and never write persistent expansion state.
- Filtering never changes the current chat or Host/overlay data.
- Active criteria remain visible and have one Reset action.
- Filter state is transient; the existing five-session preview and Show all/Collapse remain in force.
- DSH Web is not restarted without separate explicit approval.

## 2. Interface / Data Contract
```ts
type StatusScope = 'all' | 'warning' | 'ongoing' | 'done'
type RecencyScope = 'all' | '24h' | '7d' | '30d'
type ColorPreset = 'red' | 'orange' | 'yellow' | 'green' | 'cyan' | 'blue' | 'purple' | 'pink'

interface SidebarFilter {
  status: StatusScope
  color: ColorPreset | null
  recency: RecencyScope
}

interface FilterCounts {
  all: number
  warning: number
  ongoing: number
  done: number
}
```
- Counts apply text, color, and recency before the selected status.
- Recency uses the inclusive session `updatedAt` cutoff.
- Filtered derivation is pure and does not mutate input tree nodes.

## 3. Verification Checklist (Definition of Done)
- [x] Status, color, recency, priority, cutoff, pruning, and immutability unit tests pass.
- [x] Status scope, filter menu, active summary, Reset, and empty state are keyboard accessible.
- [x] Full-text search and filtered idle trees use identical filter semantics.
- [x] Filtered paths keep normal collapse controls without writing the persisted expansion store.
- [x] Search and idle results retain the five-session preview behavior.
- [x] README and README_ZH describe current behavior.
- [x] Typecheck, tests, build, and diff checks pass.
- [x] Verified changes are committed and pushed without restarting Web.
