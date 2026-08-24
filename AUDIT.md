# Audit: dsh-workspace-groups

**Fork:** `PavelLizunov/dsh-workspace-groups`
**Upstream:** `z-col/dsh-workspace-groups`
**Audited commit:** `fcaf221` (`feat(v0.7)`)
**Audit date:** 2026-08-24
**Local runtime:** DSH `0.1.0-rc.8`, Node `22.23.2`, pnpm `11.22.0`

## Verdict

**Do not install this fork into the active Web profile yet.** The plugin has a compact, understandable architecture and good storage isolation, but the audit confirmed correctness defects in path classification and drag ordering, broken actions in search mode, a false-positive browser verification gate, and incomplete accessibility. The source-level unit/type/build checks pass; live plugin activation on DSH `0.1.0-rc.8` remains unverified because the package targets `0.1.1-rc.2` peers.

No finding indicates deletion of project directories or modification of DSH core workspace/session persistence. Workspace deletion uses the official registration API; the plugin-owned writes are limited to `$DSH_HOME/workspace-groups.manual.json`.

## Architecture map

```text
cordis.patch.yml
  └─ Host apply (src/index.ts)
       ├─ GET  /workspace-groups/config
       │    ├─ YAML rules: $DSH_HOME/workspace-groups.yaml
       │    └─ manual overlay: $DSH_HOME/workspace-groups.manual.json
       └─ PUT  /workspace-groups/manual
            └─ validate → temp file → fsync → atomic rename

Client apply (src/client/index.ts)
  └─ shadows sidebar.workspaces at priority -1
       └─ GroupsBrowser.tsx
            ├─ DSH workspaces/sessions hooks and official actions
            ├─ pure grouping/search derivation (src/client/tree.ts)
            ├─ shared rules/order logic (src/core/matcher.ts)
            └─ persisted expansion store dsh.workspace.groups.view.v1
```

## Repair status

The first core-correctness batch is fixed on branch `fix/core-english-first`: cross-platform separator/root normalization, segment-boundary `pathPrefix`, hidden-rule fallback, safe handling of unavailable manual assignments, reserved `__topLevel__`, and self-drop no-op now have regression coverage. The primary runtime, tests, metadata, examples, verifier copy, and `README.md` are English-first; Simplified Chinese is isolated to its locale module and `README_ZH.md`. Ordering defects in `GroupsBrowser.tsx`, concurrency, search actions, accessibility, and the fail-open verifier remain open.

## Confirmed findings

### High

1. **Fixed on `fix/core-english-first`: directory prefix false positives** — `pathPrefix` now checks exact paths or child-segment boundaries; `/projects/app-v2` no longer matches `/projects/app`.
2. **Fixed on `fix/core-english-first`: Windows separator mismatch** — path normalization now unifies separators and preserves POSIX/drive roots.
3. **Fixed on `fix/core-english-first`: hidden rule shadows later active rules** — resolution skips hidden categories before matching and continues to later active rules.
4. **Initial grouped reorder is wrong** — when a category lacks `workspaceOrder`, reorder starts from `[]`; the drop target is lost and the dragged workspace becomes the first stored item (`src/client/GroupsBrowser.tsx:579-586`).
5. **Repeated top-level reorder resets untouched items** — the next order is rebuilt from Host order instead of the existing manual top-level order (`src/client/GroupsBrowser.tsx:566-572`).
6. **Fixed on `fix/core-english-first`: dropping a workspace on itself moves it to the end** — `moveBefore`/`moveAfter` now return the unchanged order for self-targets.
7. **Search result action menus are no-ops** — visible New Session/Rename/Delete/Fork/Archive controls call empty handlers (`src/client/GroupsBrowser.tsx:1315-1372`). Opening a session is the only functional search-row action.
8. **Browser verification can report success without running tests** — early Chrome failure produces `0/0 passed`, exit code `0` (`scripts/verify-groups.mjs:75-104,691-733`). Reproduced with `/bin/false`.
9. **Tree rows are not keyboard operable** — `role="treeitem"` rows have no `tabIndex`, roving focus, or Enter/Space/Arrow handlers (`src/client/rows.tsx:111-123,196-207,276-281`).

### Medium

1. **Full-overlay writes are last-write-wins** — multiple tabs or overlapping client mutations can silently lose changes (`src/index.ts:96-137`; `src/client/GroupsBrowser.tsx:435-617`).
2. **Fixed on `fix/core-english-first`: reserved `__topLevel__` name is accepted** — YAML/manual parsing, rename validation, assignment validation, and Client taken-name checks now reserve it; only `workspaceOrder` accepts the key.
3. **Fixed on `fix/core-english-first`: assignments to hidden categories can disappear from both group and top-level trees** — unavailable overrides now resolve safely to top level.
4. **Search order differs from normal tree** — search grouping does not apply `manual.workspaceOrder` (`src/client/tree.ts:371-436`).
5. **Target group expansion may be restored to collapsed after drop** — drop expands the target, then document `dragend` restores the pre-drag snapshot (`src/client/GroupsBrowser.tsx:529-546,588-592`).
6. **Async dialogs can affect a newly opened target** — rename/delete dialogs remain dismissible while mutations are pending; old promise settlement can close or populate a new dialog (`src/client/GroupsBrowser.tsx:345-393,962-1069`).
7. **Package Client manifest omits required `connection` dependency ordering** — runtime inject requires it, but `dsh.client.inject` does not list it (`package.json:48-55`; `src/client/index.ts:36,81`).
8. **Hardcoded root-relative config endpoints** — `/workspace-groups/*` bypass the DSH API carrier/base-path abstraction (`src/client/GroupsBrowser.tsx:89-113`). The active profile currently returns the app shell for these routes because this plugin is not mounted.
9. **Published declarations retain `.ts` import extensions** — 13 emitted imports reference source-style `.ts` paths (`tsconfig.json:16`; `lib/types/**/*.d.ts`). Consumer compatibility needs an external-package fixture test.
10. **Committed client bundle is machine-path dependent** — CSS virtual module comments embed the absolute builder path, making builds dirty across machines (`tsdown.config.ts:120-130`). Reproduced by build and reverted.
11. **No unit coverage for HTTP routes, search derivation, or DnD reducer behavior** — current tests cover core parsing/tree basics/store only.
12. **Search input has no explicit accessible name; drag sorting has no keyboard/touch alternative** (`src/client/GroupsBrowser.tsx:771-786,625-752`; `src/client/rows.tsx:190-207`).

### Low / maintenance

- A malformed manual JSON file makes the config route fail instead of quarantining or degrading to an empty overlay (`src/host-manual.ts:191-201`).
- YAML read/parse failure during PUT is returned as client HTTP 400 rather than server 500 (`src/index.ts:112-126`).
- Session fork and archive failures are swallowed or only logged (`src/client/index.ts:64-68`; `src/client/GroupsBrowser.tsx:400-404`).
- npm tarball omits `README_ZH.md` and `workspace-groups.example.yaml`; confirmed with `pnpm pack --dry-run --json` (`package.json:36-40`).
- `package.json` remains `0.1.0` while README describes v0.7 verification history (`package.json:3`; `README.md:289-315`).
- `build` uses Unix `rm -rf`, and the live verifier defaults to a macOS Chrome path (`package.json:58`; `scripts/verify-groups.mjs:35`).

## Scale assessment

- **~100 workspaces:** expected to remain usable if most projects are collapsed.
- **~500 workspaces:** repeated `find/includes` scans, whole-session-store subscription, and DnD state dispatch loops become noticeable.
- **~1000 workspaces / thousands of visible sessions:** lack of row virtualization and full-tree rerenders are likely to cause scroll and drag jank.

Primary hot paths: `src/client/tree.ts:176-190,235-247`, `src/client/GroupsBrowser.tsx:195-302,529-545,727-751`, and unvirtualized row rendering at `872-957`.

## Compatibility with DSH 0.1.0-rc.8

| Area | Result |
|---|---|
| Host `webServer.register` shape | Source-compatible by inspection |
| Workspace/session actions used by Client | Present in installed runtime types |
| Sidebar single-slot priority behavior | Likely compatible; requires live mount |
| UI primitive exports | Build verified against project peers `0.1.1-rc.2`; active runtime is older |
| Peer dependency resolution | **Mismatch:** plugin requires `^0.1.1-rc.2`, runtime is `0.1.0-rc.8` |
| End-to-end Web activation | **Not verified**; active profile was intentionally not modified/restarted |

The fork is registered as a separate DSH Workspace (`ac1c7237-f82c-48ad-8727-f91e05995ce2`) at `/var/lib/dsh/dsh-workspace-groups`.

## Verification evidence

```text
pnpm install --frozen-lockfile  PASS
pnpm typecheck                 PASS
pnpm test                      PASS — 4 files, 83 tests on fix/core-english-first
pnpm build                     PASS — host/client artifacts built
pnpm pack --dry-run --json     PASS — publication contents inspected
```

Additional reproductions:

```text
pathPrefix sibling match       confirmed true
mixed Windows/POSIX separator  confirmed no match
root pathPrefix '/'            confirmed matches every path
moveBefore/After self target   confirmed moves item to end
verify-groups + /bin/false     confirmed exit 0 with 0/0 passed
```

A rebuild changed only the absolute CSS virtual-module path comment in `lib/client.js`; the generated change was reverted so this audit branch contains documentation only.

## Recommended repair order

1. Fix rule path normalization/boundaries and hidden-rule fallback; add cross-platform tests.
2. Extract/test ordering mutations; preserve current effective order and make self-drop a no-op.
3. Replace no-op search actions with real handlers or hide unsupported controls.
4. Serialize/version manual-overlay writes and reject stale updates.
5. Make `verify-groups.mjs` fail closed; add Host route/search/DnD tests.
6. Add keyboard/touch move actions and proper tree focus semantics.
7. Widen and test DSH peer compatibility, then install this fork in a disposable profile before touching the active `web` profile.
8. Optimize only after correctness: maps/sets, memoized descendant index, fine-grained subscriptions, then virtualization when measured at ≥500 workspaces.

## Audit method

The lead reviewed the repository and ran final verification. Twelve independent Gemini workers (`ninitux/gemini-3.7-flash-high`) audited manifest/supply chain, Host, core model, Client lifecycle, UI actions, DnD, accessibility, search/tree, build/tests, security, compatibility, and scale. Worker claims were treated as leads and consolidated only where source evidence or local reproduction supported them.
