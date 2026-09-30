# Complete sidebar features on DSH 0.2.0-rc.1

## Approved outcome
Finish and install existing approved work: Workgroup/Workspace icon choice (24 bundled Tabler icons), color on folder icon instead of a dot; session color dots unchanged; persistent quick project selector combined with status/color/recency/search; complete title tooltip; periodic semantic names using only ninitux/gemini-flash-high-latest, first title then five new substantive human messages after successful turns, manual names protected. Do not restart DSH or interrupt chats/jobs.

## Reconciliation
Base 3b07d97 plus predecessor's uncommitted src/tests changes. Installed DSH is 0.2.0-rc.1 despite historical v015 directory. Installed sidebar has Error explicit-open acknowledgment but none of the new features. Predecessor's logs and claims are not acceptance evidence. Do not edit unrelated .staging/.dsh/spec files.

## Implementation invariants
- Fix selection reset only after ready snapshot; use native labelled project dropdown showing title/path, maintain normal/search parity and empty selected project visibility. Legacy filter without workspaceId loads as all. Only finite string IDs in persistence.
- Paint folder SVG using currentColor for both preset and valid CSS colors; keep session dots. Retain status indicators and manual expansion history.
- Remove speculative archive metadata deletion: archiving does not delete a session, and candidates skipped by live cleanup must not lose tags. No unrelated archive behavioral change.
- Prepare reproducible 0.2.0 source/API adaptation with published pinned dependencies, source/declaration type checks and real loader. Preserve uiWorkspace navigation and sessionStatus running/pending contract.
- Profile patch additions must use `insert` (plain id/name override rows cannot create entries). Native Loader isolation proves leaf swap retains service fibers/sessions. Do not update core, auth, provider credentials/main chat models, or restart/install over live package manager graph.
- Backup narrow artifacts/profile/overlay. Mount user-owned versioned package artifacts; verify client discovery is bound to new Host module, not old installed package. Carry current filter. Disable old leaf and insert replacements atomically only after isolated checks; guarded narrow rollback on failure.

## Verification
Root build/verify; periodic title tests incl real native manual race and cadence; DOM selection/reload/loading/deletion/search tests; theme color and tooltip behavior. Actual installed native Loader/cold profile patch composition checks before touching live state. Authenticated HTTP exact artifact, settings/overlay read-back, new provider config/availability and one bounded synthetic title test without sending chat turns. Browser interaction if reachable, otherwise explicit limitation. Process PID/start time unchanged. Commit/push task branch only task-owned artifacts.

## Delivered
All approved functions are installed and live. Root: 307 tests passed plus 11 title tests. Compatible 0.2 source typecheck/declarations/build and scoped 18 tests passed. Exact served candidate and actual Playwright project/menu/icon/color/reload/search interactions verified. Native title entry running with Gemini config and one successful synthetic live Gemini result. Runtime/service PID and start times unchanged. Versioned extensions and narrow backup retained; temporary diagnostic entries/routes removed. Detailed evidence, review, rollback location and limits: [review](sidebar-completion-020-review.md).

## Limits
No approved explicit independent Gemini/Opus reviewer tool route is exposed; use coordinator review and report lack of independence. Persisted goal resume tool rejected direct human resume, so continuation is manual; no bypass. Browser reachability unknown until tested. Deployment is included in authorization; any restart still forbidden.
