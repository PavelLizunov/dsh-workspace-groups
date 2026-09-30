# Sidebar completion: verification, review and live deployment

## Result
Installed folder-icon picker, direct folder-icon coloring, persistent project selector, full-title hover, and periodic Gemini Flash titles without restarting DSH. Native profile additions use `insert`; this was missing in the earlier unsuccessful attempts. Their 0.1.5 compatibility explanation was not supported by their own candidate manifests.

## Repository and compatibility
- Canonical branch starts at 3b07d97. Kept 0.1.5-rc.2 canonical source/dependencies intact; `scripts/prepare-020.mjs` transforms owning API points into a separately checked 0.2.0-rc.1 source tree. No local release type stubs or type aliases, no provider-specific core edit.
- 0.2 uses uiWorkspace.openSession/startSession, SessionStatus.running/pendingInteraction/completionUnread and mainView retention. The actual public types (not legacy staging assumptions) were compiled. Existing Error explicit-open acknowledgment retained.
- Published 0.2 dependency graph pinned in `scripts/compat020/pnpm-lock.yaml`. Native 0.2 loader helper and source/declaration build passed. Fresh preparation reproduced every source entry in the deployed client sourcemap.
- Removed predecessor archive cleanup edits: archive is reversible and live cleanup may skip candidates; dropping colors/pins would lose user metadata. No archive behavior change shipped.

## Checks and review
- Canonical `pnpm build && pnpm verify` exit 0: 18 files, 307 passed, 9 existing scale skips. Types, deterministic client, actual 0.1.5 loader, source/declaration consumers and isolated tarball install passed. Isolated peer warning is not a failing check.
- `npm --prefix packages/periodic-titles run verify` exit 0: 11 passed including actual Cordis/title-service manual rename race, five-message cadence, byte budget and queued/in-flight cancellation.
- Compatible build `pnpm typecheck && pnpm build` exit 0 against published 0.2.0-rc.1. Scoped compatible tests: 18 passed / 89 unselected (filter contract, selected/empty project, icon maps, Host routes, DOM picker/load/reset/error/reload). Root full suite remains the broader behavior regression evidence; old API tests are not falsely claimed to be a full 0.2 migration suite.
- Native `applyEntryPatches` + Loader root group update isolation proves disabled old leaves + inserted new leaves release routes/projection while same SessionStore/SessionTitle fiber ids and session instance stay alive.
- Coordinator review: preferences body keeps auth/size checks, project id optional for legacy but validated/bounded string; CSS colors come only from preset map or CSS.supports; icons are trusted bundled React SVG elements. Names/paths use React text, no raw HTML. No changes to auth or credentials. No independent review claimed.

## Live activation
- Backups: `/var/lib/dsh/.dsh/backups/sidebar-complete-20260930T174510Z/`, profile patch + package/lock + overlay plus receipt. Versioned user-owned extension: `/var/lib/dsh/.dsh-releases/v015-rc2-t4x7mz4n/profile/extensions/sidebar-complete-20260930T174510Z/`.
- Disabled only old `workspace-groups` and `session-title-llm`; inserted `workspace-groups-sidebar` and `periodic-session-titles`. Old installed package/manifests and shipped presets untouched. New entry settings namespace matches its id. Carry-over filter is New/done + all recency, null color, all projects.
- Runtime PID 1578499, started 2026-09-30 12:49:04 UTC; service MainPID 1578481, started 12:49:05 UTC: unchanged after activation and browser checks. No DSH restart or chat turn sent.
- Final client SHA256 `accd24254c534b6ec1b7486164802c6086190e608ce1b2367ba41737b6621262`, Host `6afcf87454a2bac074dd12e7a835094f12c97e6b6697c92a96756d3bf8ffc734`, titles `829586e285c1215d1895ada4a4df933974067ed056b952cfa20c2af6a3a3c735`. Served client revision `01db73ad5367` exactly matched candidate bytes after the native combo-map footer.
- Authenticated root/config/preferences HTTP 200. Private narrow receipt records final artifact hashes. Removed temporary authenticated diagnostic leaves and route (404 after removal).
- Active new title entry observed in actual Loader with state 2 and exact config: everyMessages=5, provider=ninitux, model=gemini-flash-high-latest. One detached synthetic request with existing session lineage (no session event/title writes) through live shared LLM helper returned `Иконки и фильтр проектов DSH`, model attribution ninitux/gemini-flash-high-latest. An initial anonymous synthetic id was rejected by egress lineage checks; did not weaken those checks. Generation does not imply every future request succeeds.

## Actual browser checks
Tool browser cannot reach server loopback; used installed same-host Playwright plus existing headless Chromium. Browser screenshots inspected, not used as click locators.
- Project dropdown with label + full path, choose a project, reload retains value, only one workspace displayed. Selected group/project temporarily auto-expand; empty selected workspace stays visible. Waited catalog loads: four real sessions, one running, no HTTP failures. No sessions opened/closed by the check.
- Workspace menu -> Choose icon -> Server -> save/reload; red colors actual SVG, no attached folder dot; original user's colors/icons restored by latest-revision narrow writes.
- Group menu -> Tools -> blue actual SVG; dark-media color remains; search scoped to selected workspace. Original group icon/color and user's filter restored after closing test browser.
- Full session title attribute checked; known initial page error reading sessionId exists before update too (stack belongs to shell/native plugin batch); not introduced or claimed fixed here.
- Page-width desktop checks only; complete touch/mobile accessibility audit and contrast campaign not performed. Native select keyboard semantics and modal contract reused. No independent reviewer or full quality campaign claimed.

## Operational limits
The repository's npm artifact remains a 0.1.5 prebuilt package; current 0.2 deployment is an explicit compatible extension and not an npm version upgrade. A separate all-repository migration is not implied. Existing user-pinned titles stay pinned; idle sessions aren't bulk-renamed; request failures retain title; very long newest messages beyond byte budget retain title. Existing open user tabs may require one page refresh to get new revision (server restart is not required).
