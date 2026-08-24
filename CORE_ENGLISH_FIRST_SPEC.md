# Spec: Core Correctness and English-First Localization

## 1. Intent & Invariants
- Fix the first core-correctness batch without changing React behavior or workspace storage.
- Normalize Linux/macOS/Windows separators while preserving POSIX and drive roots.
- Match `pathPrefix` only at the exact path or a child-segment boundary.
- Skip hidden matching rules and continue to the next active rule.
- Resolve assignments to hidden, deleted, legacy fallback, or otherwise unavailable categories as top-level.
- Reserve `__topLevel__` at Host and Client boundaries; allow it only as a `workspaceOrder` key.
- Treat workspace self-drop as a no-op.
- Keep English as the primary/fallback locale; isolate Chinese copy in its locale file and Chinese README.

## 2. Interface / Data Contract
```ts
export const LEGACY_UNCATEGORIZED_LABEL: string
export const TOP_LEVEL_ORDER_KEY = '__topLevel__'
export function normalizePath(path: string): string
export function resolveCategory(
  config: GroupsConfig,
  manual: ManualGroups | undefined,
  workspaceId: string,
  path: string,
  title: string,
): string | undefined
export function moveBefore(list: readonly string[], id: string, beforeId?: string): string[]
export function moveAfter(list: readonly string[], id: string, afterId?: string): string[]
```

## 3. Verification Checklist
- [x] Regression tests cover separators, roots, segment boundaries, hidden fallback, invalid assignments, reserved names, and self-drop.
- [x] Host parsing and validation reject reserved group/category names.
- [x] English and Chinese dictionaries live in separate files; English is registered first and DSH supplies English fallback.
- [x] Runtime code, tests, metadata, examples, and the primary README are English-first.
- [x] `pnpm typecheck`, `pnpm test`, and `pnpm build` pass on the final diff.
- [ ] Changes are committed and pushed to the working branch.
