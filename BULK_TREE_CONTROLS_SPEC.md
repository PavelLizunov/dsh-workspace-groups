# Bulk Tree Controls Micro-Spec

## 1. Overview & Objective

This document defines the behavioral and technical contract for bulk expansion management, shortcut interactions, transient filter expansion scoping, session row truncation, and fixed header placement in `dsh-workspace-groups`.

### Scope
- **Global Expansion Controls**: Collapse all, Expand groups only, and Expand all operations.
- **Per-Group Expansion & Shortcuts**: Per-group recursive toggle commands and Option/Alt-click modifier shortcuts on category disclosure chevrons.
- **State Persistence Boundaries**: Persistence of idle view states versus transient expansion states during Finder-style status/color/recency filtering; bulk commands are unavailable during text search.
- **Session Preview Truncation**: Bounded 5-session preview limit per workspace with inline expansion controls.
- **Sticky Filter Header**: Fixed positioning for filter controls, status scope bar, and active filter summary chips above the scrollable tree body.

---

## 2. Architecture & Behavior Contract

### 2.1 Expansion State & Persistence Model
- **Idle View Storage**: Baseline category and workspace expansion states are tracked in local storage under key `dsh.workspace.groups.view.v1`.
- **Explicit Collapse Contract**: Explicitly collapsing a category or workspace writes `false` to the state dictionary rather than deleting the key, enabling auto-expansion logic to distinguish deliberate user collapse from untouched default states.
- **Transient Filter Scope Isolation**:
  - When status, color, or recency filters are active, expansion operations update isolated transient state maps (`filterCategoryExpansion`, `filterWorkspaceExpansion`) for visible branches only.
  - Transient expansion changes made during active filtering do not overwrite or mutate the persisted idle expansion dictionary in `dsh.workspace.groups.view.v1`.
  - Resetting active filters discards transient state and restores the persisted idle tree expansion.
  - Bulk expansion commands are hidden while a text search query is active.

### 2.2 Bulk Expansion Operations
- **Collapse All**:
  - Sets all category folders and project/workspace folders to collapsed (`expanded: false`).
- **Expand Groups Only**:
  - Sets all category folders to expanded (`expanded: true`) while setting all project/workspace folders to collapsed (`expanded: false`).
- **Expand All**:
  - Sets all category folders and all contained project/workspace folders to expanded (`expanded: true`).
- **Per-Group Recursive Toggle**:
  - Invoking recursive expand or collapse on a specific group toggles the expansion state of the target category and recursively applies the state to every workspace contained inside that category.
- **Option / Alt-Click Disclosure Shortcut**:
  - Clicking a category disclosure chevron while holding `Option` (macOS) or `Alt` (Windows/Linux) triggers a recursive toggle on that target group and all of its enclosed projects.
  - Standard click without modifier toggles only the top-level category folder.

### 2.3 Session Preview Truncation (Five-Session Limit)
- Expanded workspace rows render up to **5 session rows** by default.
- If the currently selected active session falls outside the top 5 sessions, it is appended to ensure the current context is visible.
- Workspaces with more than 5 sessions display an inline **Show all / Collapse** toggle button.
- Toggling session preview visibility operates on a transient per-workspace level (`showAll`) without altering workspace folder expansion state.

### 2.4 Fixed Filter UI Layout
- The existing section header remains outside the tree scroll area.
- The status scope bar, filter menu, and active summary chips live in the non-scrolling `.wgTreeControls` container.
- Errors, search results, and the tree node list live in `.wgTreeScroller`, which owns vertical scrolling.
- Filter controls and active filter summary chips remain fully visible and interactive while scrolling through long tree lists.

---

## 3. Verification & Behavioral Constraints

### 3.1 Non-Intrusion & Compatibility
- All tree expansion and bulk state management are presentation-layer transforms with zero modifications to core DSH session/workspace storage files (`~/.dsh/storages/workspace.json`).
- Core workspace and session lifecycle actions (Add Workspace, rename, delete, fork, archive) operate without regression alongside bulk tree expansion states.

### 3.2 Verification Criteria
- **Global & Recursive Expansion**: Verify `Collapse all`, `Expand groups only`, `Expand all`, per-group recursive actions, and Option/Alt-click chevron shortcuts set expected `expanded` attributes across target tree nodes.
- **Filter Isolation**: Confirm expanding/collapsing nodes while filter controls are active does not modify `dsh.workspace.groups.view.v1` upon filter reset.
- **Session Bounding**: Verify workspaces with >5 sessions truncate to 5 items and expand fully on **Show all** click.
- **Scroll Pinning**: Confirm `.wgTreeControls` does not scroll while `.wgTreeScroller` owns vertical scrolling.
