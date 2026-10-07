# Mobile camera and workspace groups

## Intended result
Improve the existing DSH mobile experience, not replace its shell. Provide a resident, session-scoped Camera shortcut that invokes the existing file intake with image/* and capture=environment in the same user gesture. Photos remain in the active draft; never submit automatically. Put a right-panel shortcut in the thumb zone. Keep the left drawer and existing local patches.

Improve groups at <=767px: 44px touch controls, less indentation, two-line names, metadata on a separate line, visible actions without hover, no horizontal overflow. Keep desktop layout, stored groups, filter state, pinned sessions, calendar ranges and ordering unchanged.

## Source and invariants
Live groups client exactly matches .staging/time-range/lib/client.js (SHA256 c91174f2fb7232529086628410c9067ad22c06a6b51bbc4e68546e5f80038b08). That source includes rc.2 icon/service adaptations absent from canonical root; preserve them. Live mobile package is dsh-web-mobile 2.3.1-local.20260924.1; do not replace it with upstream 3.x wholesale. Use shipped slots and existing native file input, no new upload service or dependencies. Native camera behavior requires iPhone verification.

## Design read
Utilitarian in-app DSH interface for one-handed phone use. ENERGY 1 / RHYTHM 1 / MOTION 1. Reuse DSH tokens, icons, typography and focus states. Larger targets reduce missed taps; reduced indentation and separate metadata preserve readable titles; camera/panel actions avoid the obscured upper corner. No added animations or decorative surfaces.

## Verification
Run groups existing tests, typecheck and build against matching runtime dependencies; test mobile intake attribute restoration, cancellation/repeated invocation, disabled/missing inputs and interaction propagation. Browser checks at 320/390/430 and 1280px, light/dark; actual GUI preferred, disposable browser only. Do not submit messages, change real groups, or restart DSH. Inspect active profile and deployment ownership before activation. Save screenshots and explicit unverified limits.

## Implementation evidence (2026-10-07)
Canonical tests: 364 passed, 9 pre-existing skipped; canonical and prepared rc.2 typechecks pass. Prepared test fixtures are not rc.2-compatible (selected-session contract), so canonical behavior tests and real rc.2 browser checks are authoritative. Actual GUI loaded candidate plugins via bounded combo-factory replacement in a disposable context; deployment then verified with zero interception. Widths 320/390/430 and desktop 1280 have no horizontal overflow; desktop shortcuts/filter-toggle hidden. Native chooser opens with image/*, capture=environment and multiple=false at click time; original attributes restored. One pre-existing page error about undefined sessionId is identical before/after; no new page errors. Dark OS preference was exercised, but app theme preference may override it; do not claim true dark-theme verification.

Client-only deployment backed up at .staging/mobile-deploy-backup-20261007. No profile mutation, host restart, message submit or group mutation. Client HMR polls completed bundle files and publishes graph revisions; no dev:web source watcher was claimed. Deployed Photo button opened the native chooser with zero network interception. Deployed Panel button opened the actual full-width Start/workspace panel (screenshot retained). Physical iPhone camera/keyboard behavior remains unverified.

## Narrow desktop regression (2026-10-07)
User screenshot shows Photo/Panel on a computer. The prior desktop check covered 1280px only; width-only <=767px incorrectly enabled shortcuts in narrow desktop windows. Limit shortcut CSS to <=767px AND primary pointer coarse AND hover none, with an explicit default hidden rule. Keep groups responsive behavior unchanged. Verify real GUI with identical 390px/732px widths for mouse desktop versus touch phone, plus 1280px mouse; inspect before opening the drawer so its hide state cannot mask the defect. Rebuild from retained baseline, deploy client-only with a new backup, preserve all existing features. Component also returns null until the same reactive device query matches, preventing desktop flash if CSS is delayed or replaced. Candidate GUI checks passed for mouse desktop at 390/732/1280px and touch phone at 390px; native chooser still opens on phone. 365 tests pass, 9 existing skipped; typecheck passes. Physical iPhone remains unverified.

## Material unknowns
Authorized browser broker currently fails; no CDP listener at the old endpoint. GUI returns 401 unauthenticated. Determine current local authentication/access path without printing credentials. No dev:web watcher is running; do not promise automatic bundle rebuilds. Package-manager operations may be unavailable because approval prompts are disabled. No disruptive restart is authorized.
