# Audit: dsh-workspace-groups

**Fork:** `PavelLizunov/dsh-workspace-groups`
**Upstream:** `z-col/dsh-workspace-groups`
**Original audited commit:** `fcaf221` (`feat(v0.7)`)
**Current repair baseline:** `8424134` (`fix: stabilize rail mode and sidebar dragging`)
**Audit date:** 2026-08-24; repair status updated 2026-08-26
**Local runtime:** DSH `0.1.0-rc.8`, Node `22.23.2`, pnpm `11.22.0`

## Verdict

**The fork is installed and active in the Web profile, but it is not yet release-complete.** Live activation and the main Group/Workspace flows have been exercised on DSH `0.1.0-rc.8`; core path/order defects, Add Workspace, rail rendering, collapse restoration, move submenus, and Group drag reliability have repair commits. Remaining blockers are visible no-op Search actions, last-write-wins overlay concurrency, fail-open verifier setup, incomplete accessibility, and mixed `rc.8`/`rc.2` peer compatibility.

No finding indicates deletion of project directories or modification of DSH core workspace/session persistence. Workspace deletion uses the official registration API; the plugin-owned writes are limited to `$DSH_HOME/workspace-groups.manual.json`.

## Architecture rules

The normative entity ownership, core mechanics, dependency direction, abstraction budget, worker constraints, and amendment process are defined in [`CORE_ARCHITECTURE_RULES.md`](./CORE_ARCHITECTURE_RULES.md). Audit and review recommendations must prefer deletion/reuse and may not introduce speculative managers, repositories, services, factories, event buses, or duplicate DSH entities without an approved amendment.

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

The first core-correctness batch is fixed on `main`: cross-platform separator/root normalization, segment-boundary `pathPrefix`, hidden-rule fallback, safe handling of unavailable manual assignments, reserved `__topLevel__`, and self-drop no-op now have regression coverage. The primary runtime, tests, metadata, examples, verifier copy, and `README.md` are English-first; Simplified Chinese is isolated to its locale module and `README_ZH.md`. The DSH-native redesign adds theme-token alignment, clearer row hierarchy, keyboard focus plus Enter/Space activation, corrected accessible names, and touch-visible actions. The critical sidebar fix replaces native-only Add Workspace with a guarded browse dialog, restricts Group reorder to a handle, protects user collapse state from stale drag restoration, and adds Workspace Move-to-group submenus. The rail/DnD reliability patch hides tree/New Group in rail, makes the handle WebKit-safe, removes Group-drag folding, adds a bottom append target, cleans stale top-level ordering, and makes the CDP verifier exercise the real handle. Concurrency, search actions, full WAI-ARIA tree navigation, keyboard up/down alternatives, and the fail-open verifier setup path remain open.

## Confirmed findings

### High

1. **Fixed on `fix/core-english-first`: directory prefix false positives** — `pathPrefix` now checks exact paths or child-segment boundaries; `/projects/app-v2` no longer matches `/projects/app`.
2. **Fixed on `fix/core-english-first`: Windows separator mismatch** — path normalization now unifies separators and preserves POSIX/drive roots.
3. **Fixed on `fix/core-english-first`: hidden rule shadows later active rules** — resolution skips hidden categories before matching and continues to later active rules.
4. **Fixed by critical sidebar patch: initial grouped reorder started from `[]`** — both group and top-level reorder now start from `orderedWorkspaceIds`, preserving effective fallback/manual order and the drop target.
5. **Fixed by critical sidebar patch: repeated top-level reorder reset untouched items** — current manual top-level order is retained before applying before/after movement.
6. **Fixed on `fix/core-english-first`: dropping a workspace on itself moves it to the end** — `moveBefore`/`moveAfter` now return the unchanged order for self-targets.
7. **Search result action menus are no-ops** — visible New Session/Rename/Delete/Fork/Archive controls call empty handlers in `SearchBody`. Opening a session is the only functional search-row action. Status: current baseline debt.
8. **Browser verification can report success without running tests** — early Chrome/setup failure can produce `0/0 passed` with exit code 0. Reproduced with `/bin/false`; status: current baseline debt.
9. **Partially fixed by DSH-native redesign: tree rows are not fully keyboard operable** — rows now have focus and Enter/Space activation, but roving focus, Arrow navigation, and keyboard move/reorder actions remain open.

### Medium

1. **Full-overlay writes are last-write-wins** — multiple tabs or overlapping client mutations can silently lose changes (`src/index.ts:96-137`; `src/client/GroupsBrowser.tsx:435-617`).
2. **Fixed on `fix/core-english-first`: reserved `__topLevel__` name is accepted** — YAML/manual parsing, rename validation, assignment validation, and Client taken-name checks now reserve it; only `workspaceOrder` accepts the key.
3. **Fixed on `fix/core-english-first`: assignments to hidden categories can disappear from both group and top-level trees** — unavailable overrides now resolve safely to top level.
4. **Search order differs from normal tree** — search grouping does not apply `manual.workspaceOrder` (`src/client/tree.ts:371-436`).
5. **Fixed by critical sidebar patch: target/user expansion could be overwritten after drag** — restoration now tracks per-key user touches, so later user toggles are not overwritten by a stale drag snapshot.
6. **Async dialogs can affect a newly opened target** — rename/delete dialogs remain dismissible while mutations are pending; old promise settlement can close or populate a new dialog. Status: current baseline debt.
7. **Package Client manifest omits required `connection` dependency ordering** — runtime inject requires it, but `dsh.client.inject` does not list it (`package.json:48-55`; `src/client/index.ts:36,81`).
8. **Hardcoded root-relative config endpoints** — `/workspace-groups/*` bypass the DSH API carrier/base-path abstraction (`src/client/GroupsBrowser.tsx:89-113`). They work in the active root deployment, but non-root/base-path compatibility remains unverified.
9. **Published declarations retain `.ts` import extensions** — 13 emitted imports reference source-style `.ts` paths (`tsconfig.json:16`; `lib/types/**/*.d.ts`). Consumer compatibility needs an external-package fixture test.
10. **Committed client bundle is machine-path dependent** — CSS virtual module comments embed the absolute builder path, making builds dirty across machines (`tsdown.config.ts:120-130`). Reproduced by build and reverted.
11. **Coverage remains incomplete** — current tests cover core, tree/store semantics and source contracts, but HTTP routes and rendered Search/dialog/DnD interactions still lack runnable component coverage.
12. **Partially fixed accessibility controls** — Search now has an explicit accessible name and Workspace move has a menu alternative; Group Move Up/Down, full tree navigation, and live announcements remain open.

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
| Sidebar single-slot priority behavior | Live mount verified; plugin shadows the official browser at priority -1 |
| UI primitive exports | Build and live render verified; mixed peer versions remain a compatibility risk |
| Peer dependency resolution | **Mismatch:** plugin requires `^0.1.1-rc.2`, parts of runtime/profile remain `0.1.0-rc.8` |
| End-to-end Web activation | **Verified for activation and manual smoke; full disposable-profile suite remains open** |

The active profile links the package checkout at `/var/lib/dsh/Project/dsh-workspace-groups`. A previously audited separate Workspace registration used id `ac1c7237-f82c-48ad-8727-f91e05995ce2`; its old path evidence is historical and not the active package link.

## Verification evidence

Current repair baseline `8424134`, verified 2026-08-25/26:

```text
pnpm typecheck                 PASS
pnpm test                      PASS — 5 files, 120 tests
pnpm build                     PASS — host/client artifacts built
node --check verify script     PASS
live Web activation            PASS — active linked package and JSON endpoint
```

Historical original audit at `fcaf221`, 2026-08-24:

```text
pnpm install --frozen-lockfile  PASS
pnpm pack --dry-run --json     PASS — publication contents inspected
```

Historical original-audit reproductions at `fcaf221`:

```text
pathPrefix sibling match       reproduced before fix
mixed Windows/POSIX separator  reproduced before fix
root normalization defect      reproduced before fix
moveBefore/After self target   reproduced before fix
verify-groups + /bin/false     still open: exit 0 with 0/0 passed
```

The first four reproductions are fixed in current `main`; the verifier setup failure remains baseline debt. The original audit branch was documentation-only, while current repair evidence is represented by the current baseline commit and verification block above.

## Recommended repair order

1. Replace no-op Search actions with real handlers or hide unsupported controls.
2. Guard pending dialogs and surface Fork/Archive errors.
3. Serialize/version manual-overlay writes and reject stale updates.
4. Make `verify-groups.mjs` fail closed; add Host route/rendered Search/DnD tests.
5. Add Group Move Up/Down, valid tree ownership, roving focus and live announcements.
6. Run the disposable-profile GUI/compatibility gate and record the early active-profile installation as closed debt only after it passes.
7. Align supported peer versions and package/consumer gates.
8. Optimize only after correctness: maps/sets, memoized descendant index, fine-grained subscriptions, then virtualization when measured at ≥500 workspaces.

## Audit method

The lead reviewed the repository and ran final verification. Twelve independent Gemini workers (`ninitux/gemini-3.7-flash-high`) audited manifest/supply chain, Host, core model, Client lifecycle, UI actions, DnD, accessibility, search/tree, build/tests, security, compatibility, and scale. Worker claims were treated as leads and consolidated only where source evidence or local reproduction supported them.
