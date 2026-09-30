# Fix quadratic 0.2 sidebar selection lookup

## Outcome and scope
Restore responsive grouped sidebar after 2026-09-30 deployment without restarting DSH, interrupting chats/jobs, changing filters or modifying core. User reports flashing/reconnects and one ~200000-line diff. Scope: compatibility source generator, regression test, rebuilt compatible client plugin. Other plugin errors and huge diff remain separate until evidence warrants changes.

## Evidence
Isolated authenticated Chromium at existing host URL reproduces continual 750ms main-thread tasks, near full renderer core; original diagnostic cannot complete in 90s. CPU profile places >80% samples in generated mainSessionId, called repeatedly inside every session iteration. It allocates Object.values(list.byId) and scans all retained sessions each call. Installed api-session-controller replaces byId when retention changes (publishRetention), so byId identity is a valid cache key. No chat selected in this reproduction; huge diff is not necessary to reproduce.

## Change
WeakMap cache keyed by immutable byId snapshot in 0.2 compatibility helper; cache undefined too. Keep return semantics and branding unchanged. Add executable tests against actual generated helper: selected ID, missing selection, independent lists, replacing retained map, repeated N lookups on N rows enumerate map once. Rebuild isolated compatible staging artifact; first verify via browser response interception (no live changes). Do not rebuild shipped runtime or edit core.

## Verification and deployment
Run focused helper tests, compatible typecheck/build, plugin existing tests. Browser before/after same host, Chromium, auth, sidebar state, observer and 30s observation; compare max/total long tasks, readiness and live socket opens/closes. Profile-wide HMR/replacement requires explicit approval if it may remount user UI; no restart approval implied. Commit/push scoped files on dedicated task branch; preserve unrelated staging/untracked work. INC-1377 stays open until live user-visible fix confirmed.

## Applied and verified
User explicitly approved client-only live update via ask_user_question. Applied 2026-09-30 19:31:48 UTC by atomically replacing built client.js and its map in the existing user-owned extension; backup in isolated stage rollback-live. Built client diff is exactly the selection helper (15 diff lines). Source helper synchronized. No dev:web watcher runs; the client HMR transport polls entry artifacts, but no promise that every existing user tab has refreshed.

Live verification without interception, 19:31:59–19:32:30 UTC: GUI becomes ready, one remote.mux socket, no closes, no HTTP failures, 4 startup long tasks, maximum 337ms (none over 500ms), no continuous stall. Profile dominated by idle, selection no longer a hotspot. DSH service PID/start timestamp/restart count unchanged (12:49:05 UTC, NRestarts=1).

Canonical pnpm test: 311 passed, 9 skipped; all canonical typechecks pass. Generated compatible typecheck and build pass; focused generated-helper suite 4/4. Full compatible suite is NOT green: 44 failures and one failed suite on both original deployed staging baseline and fixed candidate, caused by old 0.1.5 test mocks (no retainedBy/uiWorkspace.open) and an omitted verify-groups script. Candidate adds 4 passing tests, does not add failures. These are pre-existing compatibility-test debt, not claimed repaired.

## Limits and remaining work
Fresh browser yields unrelated sessionId undefined exception in jev-prune and React #130 footer slot; these persist independently. Original client reconnect itself not reproduced (one socket observed), but event-loop blockage explains reported sluggishness. User chat with huge diff not yet identified; ask for its link to distinguish native diff allocation from sidebar load. Live sidebar cause is repaired; full incident remains open pending user's tab and affected-chat verification.
