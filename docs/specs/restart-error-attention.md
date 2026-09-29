# Preserve Error until an explicit sidebar open

## Result and scope
- Follow-up to INC-1372 and `acknowledge-error-attention.md`: a restored selected session, or an error arriving while it is selected, must retain Error until the user explicitly opens its row after that error.
- Keep Error for `error`, `interrupted`, and `max-tokens`. Explicit sidebar open acknowledges only the currently observed revision; preserve this across reloads, and show a newer revision again.
- Remove acknowledgment from snapshot reconciliation and selected-row derivation; add a small explicit store action used by the common normal/search row-open handler. Keep completion, pending interactions, aggregation, filters and retention intact.
- No Host/core changes, session-log writes, restart, deployment, dependency or profile changes. Do not infer an error from running -> idle: successful turns also make that transition.
- Keep existing acknowledgments: old automatic and intentional acknowledgments are indistinguishable. This fix cannot reconstruct already hidden incidents.

## Verification
- Red/green regression for a restored selected error in both normal/search trees; DOM mount/reload must not acknowledge it. Click the already selected row to acknowledge; navigation/reload preserves that acknowledgment. A newer error while selected remains visible.
- Cover all terminal reasons, stable/pruned maps, ready-list guard, pending interactions, no stale Done replacement, counts and collapsed ancestors.
- Run focused tests, `pnpm build`, `pnpm verify`, and `git diff --check`. Review task diff, commit generated lib and README parity, push a dedicated origin branch.

## Unknowns and limits
- The user cannot supply a concrete interrupted session. Do not claim to have identified its recorded terminal reason or the cause of the DSH restart.
- Read-only installed runtime inspection: `dsh-session-query/lib/index.js:34-53` adds synthetic interrupted closers on cold reads without writing storage; `dsh-agent-loop/lib/index.js:1927-1956` appends interrupted closers on resume. This proves recovery paths exist, not that every sidebar summary receives an interrupted projection immediately on startup.
- Repository dependencies target 0.1.5-rc.2; earlier deployment record identifies installed 0.2.0-rc.1. Repository build is not deployable there without compatibility work and separate explicit deployment approval.
- No permitted explicit independent reviewer route is available; coordinator inspection is not independent review. Live installed interaction remains unverified.

## Evidence and delivery
- Base: `1242358` on `fix/acknowledge-error-attention`; unrelated untracked files were preserved.
- Red: `pnpm exec vitest run tests/tree.test.ts tests/rows.dom.test.tsx -t 'preserves restored selected|clears Error on click'` exited 1 with four expected failures: selected terminal reasons disappeared and restored selected DOM had no Error pill.
- Green: `pnpm exec vitest run tests/tree.test.ts tests/store.test.ts tests/rows.dom.test.tsx` exited 0, 72 tests passed. Covers mount/remount with an unacknowledged selected error, click of that already-selected row, new revision while selected, repeat click, navigation, JSON persistence and loading guard. Pure tests cover all three terminal reasons, search/normal trees, counts, pruning and ancestor aggregation.
- `pnpm build && pnpm verify && git diff --check` exited 0: 17 files, 297 tests passed, 9 pre-existing scale skips. Type checks, real-loader regression, deterministic bundle, source/declaration consumers and isolated tarball install passed. Isolated install reported a peer-dependency warning, not a failing check.
- Coordinator reviewed the task source/test/README diff and shared normal/search handler; no Host/core/dependency changes. Generated client and declarations synchronized.
- Delivery gate: prose grounding/parity PASS; no new commands/links in README edits. Visual styling/contrast/new controls N/A. Changed interaction PASS in jsdom with mocked platform services; installed browser interaction NOT VERIFIED. No restart or deployment performed.
- Remaining: separately authorized compatibility build/deployment for the actual installed runtime, plus live verification. The user's original missing session cannot be retrospectively diagnosed; already stored automatic acknowledgments are preserved, not guessed away.
