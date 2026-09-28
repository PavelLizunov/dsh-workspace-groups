# Acknowledge error attention when a session is viewed

## Result and root cause
The sidebar currently renders every durable `error`, `interrupted`, or `max-tokens` projection as Error, independently of session selection. Opening only clears completed reminders. Treat these terminal errors as unread attention: clear their badge when selected, retain acknowledgment across navigation/reload, and show a later error again.

## Scope and invariants
- Client-only fix using the existing persisted view store; no Host projection changes, API calls, core storage writes, installation, or DSH restart.
- Persist acknowledgment of the observed error revision per session; use the available summary `updatedAt` plus reason as the revision key. A changed revision is conservatively unread (including metadata updates); the current Host projection does not expose an error event ID.
- Reuse ready-list completion reconciliation for acknowledgment/pruning. Preserve acknowledgment while snapshots are loading. Legacy view state needs no migration.
- Apply identical status semantics to normal/search trees, parent aggregation, status counts, and filtered-session retention. Do not replace an acknowledged Error with a stale Done reminder.
- Pending approval/question/plan-review and SDD awaiting-user are not acknowledged by merely viewing. Existing completion, running, archive, and folder expansion rules remain intact.
- Build committed lib outputs, update the three owning READMEs, commit only task-owned changes and push a dedicated task branch to origin. Leave existing unrelated untracked artifacts untouched.

## Verification
- Regression red/green: selected errored session loses Error, stays clear after selecting another session and JSON persistence round trip; newer error becomes unread.
- Cover all three terminal reasons, pending interactions, normal/search counts and collapsed parents, readiness guard, legacy state, deletion/archive pruning, and real DOM session-open behavior.
- Run `pnpm build`, `pnpm verify`, and `git diff --check`; inspect the final task diff.
- Installed GUI is not part of this repository-only change; live behavior requires separately approved deployment. No independent reviewer route is available in this session; coordinator review is not independent acceptance.

## Evidence
- Reproduced before implementation: `pnpm exec vitest run tests/tree.test.ts -t 'clears terminal error attention'` failed (exit 1): selected session still aggregated as `error`.
- Focused tree/store/DOM tests passed (70 tests). Initial test-fixture type errors were corrected to use branded session IDs, the actual `pending` phase, and the WorkspaceView-returning callback contract.
- `pnpm build && pnpm verify && git diff --check` passed (exit 0): 17 test files, 295 tests passed, 9 pre-existing scale tests skipped; type checks, real-loader regression, deterministic bundle check and isolated tarball consumer passed. The isolated install emitted a peer-dependency warning but its consumer checks passed.
- DOM regression exercises the actual GroupsBrowser session click, navigation away, JSON state round trip/remount, and pending-list readiness guard. Pure regressions cover terminal reasons, renewed error revisions, pending interactions, search/normal counts, collapsed parents, filtered-session retention and archive exclusion.
- Coordinator inspected the source/test/README diff. No installed profile or running DSH component was changed. Live authenticated GUI behavior and independent review remain NOT VERIFIED.

## Delivery gate
- Documentation: PASS for factual behavior, parity across English/Russian/Chinese, and task-scoped prose; no new links or commands.
- UI visual design, contrast and new controls: N/A (no visual/control changes).
- Interactive verification: PASS for the changed click/navigation path in jsdom with mocked platform services; NOT VERIFIED in the installed GUI.

## Approved deployment: 2026-09-28
The user subsequently authorized both the installed Error fix and the stable launch path, without a DSH restart or a broad verification campaign.

- Actual runtime and installed plugin: **0.2.0-rc.1**, despite legacy directory/profile names. The repository's 0.1.5 build must NOT be copied over the installed client.
- Rebuilt the client from commit `103ac4926633c8a66766603a0bf174a4d1a399d5` plus installed sourcemap compatibility sources, preserving `mainSessionId`, `sessionStatus`, `completionUnread`, `uiWorkspace.openSession`, and Medium icon exports. [Compatibility source patch](error-client-020-compatibility.patch) applies to that commit and reproduces the build input; it is not a completed migration of package metadata/types/tests to 0.2.0.
- Build command in the isolated source directory: `./node_modules/.bin/tsdown --filter dsh-workspace-groups/client` (exit 0). Published only `client.js` and its source map by atomic replacement. Installed Host bundle and package manifest hashes remain unchanged; version stays 0.2.0-rc.1.
- Observed the live SSE `rebuilt` event: revision `c277692c0548` became `f789614dbb2f`. Retrieved the new served artifact and verified exact equality with the installed code plus the documented combo/source-map wrapper. New client SHA256: `f103dd94c78bfa41d78d2446aa59a2c805da46d6441410e27c9735d74ac481e5`.
- Private rollback: `/var/lib/dsh/.dsh/backups/error-stable-runtime-20260928T214730Z/` (original client/map, launcher and hash receipt). The original profile tarball remains unchanged; reinstalling it would remove this hotfix. The deployed source map and compatibility patch preserve its source.
- No dev:web watcher was running. The installed client-HMR polling transport nevertheless observed the explicit artifact publication. Browser receipt/remount and click behavior are NOT VERIFIED; this is not a promise of automatic browser completion.

## Stable launch path
Created `/var/lib/dsh/.dsh-releases/current` pointing at the active release without moving the directory. Applied [launcher patch](stable-runtime-launch.patch) to the existing user-owned production launcher. It now derives its CLI from `DSH_RELEASE_ROOT`, default `$HOME/.dsh-releases/current`, ignoring obsolete `DSH_SHARED_CLI` environment values. Node/profile/locking/shutdown behavior is unchanged.

`bash -n` passed; the stable link resolves to the existing CLI. Service MainPID remained **1215155**. No DSH or systemd reload/restart was performed. The current process argv necessarily retains the original path until a separately authorized future restart. Root-owned systemd drop-ins still contain old values: they could not be edited by this user and sudo is unavailable under no_new_privs. They are no longer used by the revised launcher; their cleanup is explicitly outstanding. The launcher directory has no GitHub remote; its task-owned diff is backed up here rather than committing unrelated scripts.

## Limits
Acknowledgment uses `updatedAt` plus reason because the current projection supplies no error event ID: metadata updates may re-show Error, and identical reason/timestamp events without an observed intervening reset cannot be distinguished. Installed GUI interaction, next process startup, independent review and a full 0.2.0 repository migration were not exercised or claimed.
