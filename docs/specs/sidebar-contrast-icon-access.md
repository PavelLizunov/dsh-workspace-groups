# Fix project dropdown contrast and discoverable folder icon selection

## Approved outcome
User reports project filter functions but its white-on-white native popup is unreadable, and cannot find folder icon selection. They already fixed lag with another agent. Fix and publish only compatible sidebar Client, without reverting that fix or changing Host/title/profile/session behavior. No restart.

## Reconciled baseline
Checkout branch fix/sidebar-quadratic-selection-20260930, HEAD 517eb85. Live sidebar extension sidebar-complete-20260930T174510Z has WeakMap byId mainView selection cache and chooseIcon menu entry wired. Current file client SHA256 42bee4f3398232af7e2b969e174d1a63dd33453500b9b25aa7bbf0e0ac972b9e. Preserve exact selection helper/source and validate cached-call test. No bulk rebuilding over unknown live source drift.

## Minimal implementation
- Native project select and options: opaque theme surface --dsw-alias-bg-layer-1, theme text and border tokens, theme-appropriate color-scheme keyed to DSH body[data-ds-dark-theme] (respect explicit theme, not only OS); Canvas fallbacks. Keep native keyboard behavior and filter persistence.
- Group/workspace icon itself becomes a small accessible button when onChooseIcon exists. click/Enter/Space open existing picker, do not expand row or start drag. Keep default icon/selected SVG, chosen color, menu entry, existing chevrons, drag source, status, aria tree hierarchy. No new polling/render source/model requests.
- Documentation EN/RU/ZH parity on clicking folder mark. No style redesign, arbitrary SVG or extra library.

## Verification
Read current sourcemap, source/tests; actual same-host Chromium light+dark select/options computed contrast >=4.5, screenshot inspection and project selection/reload; icon click for group/workspace opens 24 choices, choose/reset/save/reload works, row click not propagated; keyboard test. Root typecheck/build/full verify and compatible typecheck/build/scoped DOM + native loader. Diff live/candidate sourcemap must show only styles/rows (+new direct-control module if needed); selection helper matches exactly and cache test passes. Publish client.js/map atomically with rollback, unchanged Host/profile/process PID; exact served bytes/browser recheck; commit/push dedicated task branch.

## Delivered and verified
- Root pnpm typecheck/build/verify exit 0: 312 tests passed, 9 existing scale skips; real loader and isolated consumers passed. Generated 0.2 typecheck/build and scoped DOM six tests passed. Cached generated helper regression 4/4 passed. Full compatible old-API suite not claimed.
- Actual before probe: select/options backgrounds transparent and --dsw-alias-interactive-bg-secondary absent. Corrected to --dsw-alias-bg-layer-1 and explicit theme color-scheme/options. Browser both intercepted candidate and final live artifact: light foreground #0f1115 / #fff = 18.90:1; dark #f9fafb / #232324 = 15.03:1 (select and option computed styles).
- Browser clicks group folder icon -> 24 choices; Enter on workspace folder icon -> picker; choose Server, save/reload persists; no row expansion propagation. User filter/icon restored after closing test page, narrow latest-revision overlay write. Two sockets across reload, no closes in observed check. No performance campaign.
- Live/candidate sourcemap diff exactly rows.tsx and added FolderIconControl.tsx; separately compiled inline CSS changed. session-status.ts cache helper and all other mapped sources exactly equal. No restore of old quadratic lookup.
- Client-only atomic publish; backup /var/lib/dsh/.dsh/backups/sidebar-contrast-icons-20260930T202333Z/. Final client SHA256 26e6e6de6c966521865ef62d3b3751b1f0c42d2732551c558231db10b358a10e, exact served revision 6de485a3a56a verified. Host hash 6afcf87454a2bac074dd12e7a835094f12c97e6b6697c92a96756d3bf8ffc734 unchanged. DSH PID 1578499/start 12:49:04 UTC and service MainPID 1578481/start 12:49:05 UTC unchanged.
- Profile settings are saved during tests through existing Host route, so profile hash is not asserted constant across tests; no manual profile changes. No title/provider/core/auth changes. Existing tabs may need one browser page refresh.
- Coordinator reviewed button bubbling/drag isolation, React SVG safety and native select keyboard semantics. Screenshot inspected in dark theme. Linux Chromium native popup checks and computed option contrast passed; mobile/Windows/macOS native popup rendering not exercised. Anti-slop gate: existing visual vocabulary, no new layout/dependency, grounded README parity PASS; cross-platform visual acceptance limited as above.

## Limits
User's already repaired lag is out of scope; no performance campaign. Browser MCP cannot reach loopback; use already installed same-host Chromium. No independent worker route available under model constraints. Do not modify user colors/filter permanently during checks; restore narrow test-owned keys with latest overlay revision and close tab before restoring filter.
