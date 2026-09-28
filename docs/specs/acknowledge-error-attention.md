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

## Remaining deployment step
The repository fix is ready for separately approved deployment and verification of the exact served client bundle. It does not retroactively update the installed plugin. Acknowledgment uses `updatedAt` plus reason because the current projection supplies no error event ID: metadata updates may re-show Error, and identical reason/timestamp events without an observed intervening reset cannot be distinguished.
