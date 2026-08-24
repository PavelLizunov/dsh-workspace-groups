# Spec: DSH-Native Workspace Groups Redesign

## 1. Intent & Invariants
- Bring the grouped browser visually in line with the official DSH sidebar while keeping Group → Workspace → Session hierarchy clear.
- Use official `--dsw-alias-*` theme tokens, existing DSH primitives, and official row dimensions.
- Keep groups section-like, workspaces primary, and sessions visually quieter.
- Preserve grouping, search, dialogs, drag-and-drop, storage semantics, `data-wg-*`, payload types, and verifier-facing classes.
- Make row actions available on hover, keyboard focus, open menus, and touch/coarse pointers.
- Do not install into or restart the active `web` profile in this batch.

## 2. Interface / Data Contract
```tsx
export function CategoryRow(props: ExistingCategoryRowProps): JSX.Element
export function WorkspaceRow(props: ExistingWorkspaceRowProps): JSX.Element
export function SessionRow(props: ExistingSessionRowProps): JSX.Element

export const DND_WORKSPACE_TYPE = 'application/x-dsh-workspace-groups'
export const DND_CATEGORY_TYPE = 'application/x-dsh-workspace-groups-category'
```

Stable DOM/CSS contracts: `data-wg-category`, `data-wsid`, `wgCategoryRow`, `wgProjectRow`, `wgSessionRow`, `wgDropTarget`, `wgInsertBefore`, `wgInsertAfter`, `wgSelected`, `wgMatched`, and `wgRowActions`.

## 3. Verification Checklist
- [x] Source-contract regressions cover row keyboard access, labels, header/search classes, DnD selectors, alias tokens, focus, and touch actions.
- [x] Category, Workspace, and Session rows support Enter/Space and visible focus; full roving focus and Arrow navigation remain a later accessibility stage.
- [x] Header/search markup follows the official DSH expansion pattern.
- [x] CSS uses DSH alias tokens and 34px/32px row dimensions.
- [x] Actions remain visible for focus, open menus, and coarse pointers.
- [x] `pnpm typecheck`, `pnpm test`, and `pnpm build` pass on the final diff.
- [x] Generated `lib/` is updated and reviewed.
- [ ] Changes are committed and pushed to `origin/main`.
