# Reset control and opened-filter review

## Outcome and bounds
User requested better reset button and opening/visually inspecting all filters. Native DSH reference, ENERGY 1 / RHYTHM 1 / MOTION 1. Improve reset as an explicit icon-labelled button in a stable summary header; chips below. Reset retains existing filter-only semantics (group/workspace/status/color/period; search untouched); native focus returns to All after summary disappears. Preserve persistence, icons, counters, menus and attention behavior. No new dependencies, core/auth changes or service restart.

## Plan
Open four menus on actual served UI first; capture and inspect dark/light and narrow viewport. Record observed problems rather than assumed ones. Add published refresh icon, dedicated native button styling, summary header/chip wrap layout. If review exposes local width/contrast/selection flaws in filter popups, fix those within same scope. No unrelated sidebar controls.

## Verification
Canonical build/verify and reset DOM assertions (one button, all fields clear, focus and visible label/icon). Compatible published rc2 preparation and actual loader. Browser open each group/workspace/color/period menu in dark/light; exercise selection, Escape/outside and keyboard; narrow/coarse-pointer bounds, text contrast. Reset with all five filters set and prove persisted defaults/search unchanged, restored previous preferences afterward. Use existing verified client-HMR artifact path, backup exact targets, compare served bytes; service PID stays unchanged. Commit/push task-owned edits to dedicated branch.

## Observed initial review
Opened all four actual served menus in dark/light. Group popup measured 145px and workspace 151px while triggers were 248px; color/period were 260/156px and fit viewport. Scope labels need a wider common popup (260px capped by viewport) and coarse-pointer rows >=44px. Baseline screenshots visually inspected. Add these scoped CSS adjustments; no redesign of native menus.

## Final evidence
Canonical build/verify passed (340 tests, 9 existing skips), real-loader/consumer passed. Exact published rc2 typecheck/build/installed ClientModuleSystem passed. HMR artifact SHA256 cb2d24cb3ea3c4bf25f20170b9e0a8ad800a5d037d3cae20225f945b9dc43dc3 equals served registration, revision 0854af744bb3. Live reset with all five conditions selected cleared persisted defaults, removed summary, preserved actual search input and focused All. At sidebar widths 240/280/360 in both themes button stayed within header, 44px touch height; chips below header. Opened each group/workspace/color/period menu in both themes and inspected all eight screenshots; menus fit viewport, scope popup widths now 260px. Coarse-pointer scope-row and Arrow/Escape checks run separately. Preferences restored. Active service PID/start unchanged (2359515 / 12:11:37); no restart/core/auth changes. Baseline sessionId pageerror remains outside scope.

## Unknowns
Live authentication state may expire; use native launch URL only, keep private state outside Git. Menu geometry depends on host primitives; native material can be transparent, do not compare transparent backgrounds as black. Existing sessionId pageerror outside scope, track baseline. Review is local, not a multi-agent campaign.
