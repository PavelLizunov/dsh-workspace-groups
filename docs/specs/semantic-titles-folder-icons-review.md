# Focused feature verification and security review

## Scope
Base `b664d22`, branch `feat/semantic-titles-folder-icons`, task-owned working tree: icon types/parser/overlay/menu/rendering/locales/styles and tests; new optional `packages/periodic-titles` companion. Existing unrelated .staging/.dsh/spec artifacts excluded. Coordinator review, not independent acceptance; no authorized explicit independent worker route available.

## Traced boundaries
- Authenticated PUT -> existing wrapper/revision check -> parseManualGroups -> icon allowlist -> atomic overlay persistence. New fields do not alter native authentication/CSRF gates or body limits. Group/workspace IDs occupy separate maps. SVG data is pinned vendor artwork rendered through React elements, never dangerouslySetInnerHTML, user-supplied SVG or remote URLs. Invalid artwork IDs and malformed maps rejected in tests; special `__proto__` keys preserved as own data properties (including rename).
- Folder actions -> native menu -> picker -> revision-checked save -> normal/search rows. Native button keyboard semantics and Modal focus/close contract retained. Busy choices disabled; save error remains in dialog. Full interactive browser/contrast/mobile review not performed; DOM tests are not visual acceptance.
- Human session events -> successful turn boundary -> substantive-message count -> native title refresh -> shared LLM helper -> native normalization/attribution/log event. Manual-title source checked before dispatch; actual native service test verifies racing manual rename prevents stale acceptance. New input invalidates queued checks and aborts active periodic requests, including a stream ignoring cancellation. Native provider cancellation and disposal remain in force. No additional API route or credentials; inherited route unless explicit optional pair is supplied in user profile.
- One title provider only: plugin fails on conflicting registration; no takeover or runtime config edit. No live model calls, core changes, Host restarts or activation performed.

## Evidence
- Root `pnpm build && pnpm verify && git diff --check`: exit 0, 306 tests passed, 9 existing scale skips, 18 test files. Type checks, actual 0.1.5 loader, deterministic bundle, declarations and isolated package-consumer installation passed. Isolated dependency installation emitted peer warnings, not check failures.
- Focused DOM tests cover chosen group/workspace icon rendering, intact colors/attention, menu callbacks, 24 labelled choices, selected state/reset/busy protection, actual GroupsBrowser save/remount/reset. Real route test verifies persistence, invalid IDs and stale revision rejection. Overlay tests cover namespace collision, group rename, deletion, move and legacy data.
- Companion tests use published 0.2.0 native helper and actual Cordis/session/title services where relevant. No network provider call. Final verification result recorded in the main task spec.
- Pinned Tabler v3.48.0 source hashes and MIT license retained and included in packaged sidebar. README EN/RU/ZH updated with compatible Host+Client requirement and separately activated 0.2.0 companion.

## Findings and limits
No new confirmed exploitable issue in the reviewed task paths. Initial icon rename assignment lost a `__proto__` key; corrected to an own-property definition and covered by regression. A queued end-of-turn title check could overlap immediately arriving new input; added revision guard and regression before final delivery.

Live 0.2.0 sidebar compatibility build/deployment, real model title quality/availability, full browser keyboard/modal behavior, theme contrast and mobile rendering remain NOT VERIFIED. Main sidebar build remains 0.1.5; installing it over the active 0.2.0 profile directly is unsafe. Companion failure-attempt deduplication is in-memory; a restart can allow a retry. Exact acknowledgments are RU/EN, not an LLM intent classifier. Oversized newest messages retain prior title. No mass migration or retroactive rename of idle sessions.

## Delivery gate
- Prose grounding and three-language behavior parity: PASS.
- SVG provenance/license and no runtime image requests/raw SVG: PASS.
- Changed interactions in jsdom: PASS; actual installed browser: NOT VERIFIED.
- Existing visual vocabulary preserved; no new typography/animation: PASS by source inspection. WCAG contrast/mobile visual measurement: NOT VERIFIED.
