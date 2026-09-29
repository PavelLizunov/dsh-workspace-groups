# Periodic semantic titles and folder icons

## Agreed result
User requested semantic session names rather than first-message text and selectable icons for Workgroup/category and Workspace. User chose periodic updates and DSH-style icons, including reuse of existing SVG collections. Preserve manual renames, existing Error hotfix, colors, filters, ordering and session execution.

## Design and research
- UI uses the existing DSH styling/tokens and native Menu/Modal, not a standalone design or a replacement sidebar. Reading this as an in-app utility addition for the existing DSH user, calm compact DSH aesthetic; ENERGY 1 / RHYTHM 1 / MOTION 1. No new animation/palette/typography.
- No standalone opendesign system exists. User explicitly chose DSH-style icons; use current codebase patterns, no unrelated design scaffold or server.
- Native title service supports first-prompt/all-prompts providers, durable title source, manual-title pinning, supersession and cancellation. Shared title LLM helper supports exact selected messages, byte limit and bounded auxiliary requests. Published all-prompts provider lacks periodic cadence and retains old titles on oversized history. Verdict: Extend native service/helper through an optional installable companion, not core edits.
- https://unpkg.com/@deepseek-ai/dsh-session-title-all-prompts-llm@0.2.0-rc.1/README.md ; installed title and title-llm README/types/source inspected.
- SVG options inspected: https://tabler.io/icons (MIT, https://raw.githubusercontent.com/tabler/tabler-icons/main/LICENSE), https://lucide.dev/license (ISC plus MIT-derived icons). Verdict: Adopt a small vendored Tabler Outline subset, retaining license and provenance, no external URLs/raw uploaded SVG accepted at runtime. Search API unavailable (402); official sites/registry fetched directly.

## Scope and invariants
### Icons
- Choose/reset an icon from the existing group/workspace actions, with a compact labelled picker. SVG uses currentColor, existing 16px row sizing; color dot and expansion chevron stay independent. No session icons or arbitrary SVG uploads.
- Persist optional namespace-separated category/workspace icon maps in manual overlay (avoid name/id collisions). Strict allowlist validation, legacy absence valid, normal/search parity. Group rename transfers icon; deletions clear relevant references. Unknown stored identifiers must never become HTML/URLs.
- Native authenticated routes and optimistic concurrency remain unchanged. Icon persistence requires compatible Host and Client deployment, not client-only hotfix.
### Semantic titles
- Optional separately mounted companion targeting actual DSH 0.2.0-rc.1; sidebar repository remains compatible with declared 0.1.5-rc.2. Use published pinned dependencies in companion, no local release type aliases/stubs.
- First semantic generation via native first-prompt lifecycle, then periodic check at completed turn boundaries after five new substantive human messages. Exact short acknowledgment/continue commands excluded from periodic count, not arbitrary short topic text.
- Reuse native title provider, shared LLM helper, native durable title events. Manual/user source never auto-refreshed. No polling or scanning persisted session files, no mass retitling old sessions. Existing sessions can update as new substantive messages accrue.
- Bound selected exact user-message history to configured byte budget (recent context, original topic if it fits). Preserve seq attribution; never fabricate assistant text as user text. No unbounded log growth from no-op title revisions. Failures retain current title; do not retry repeatedly on tool steps.
- No provider/model/credential changes; inherited route by default, explicit optional route only in user-owned config. No live model calls during tests.

## Verification
- Icons: parser/validation, separate keys, reset/rename/delete/move, persistence and stale-write routes, DOM choose/reset, normal/search rendering, colors/attention/drag unaffected; keyboard picker and accessible labels. Verify vendored license/paths.
- Titles: native contract integration and deterministic stub LLM; cadence, confirmation exclusions, long history, manual rename race, cancellation/disposal, restart reconstruction, subagent exclusion, no request on skipped turns, bounded failure behavior.
- Build committed lib; pnpm verify; companion checks against published 0.2.0 dependencies. Review diff and README parity; commit/push dedicated origin task branch.

## Authorization and unknowns
Implementation authorized by feature request and explicit choices. No deployment or restart authorized for these new features; prior Error deployment approval does not cover them. Activation must preserve active sessions and have its own approval. Installed browser access currently unavailable; do not claim live UI acceptance. Independent reviewer route unavailable under current model/tool policy.

## Implementation and evidence
- Implemented 24 pinned Tabler v3.48.0 icons, native actions/picker, group/workspace namespace persistence, allowlist validation, reset/rename/delete hygiene, normal/search wiring, locale keys and packaged MIT attribution. Existing Error behavior retained.
- Implemented separately installable `packages/periodic-titles` for 0.2.0-rc.1 using pinned published native title/helper dependencies; no core or active profile changes. First-prompt lifecycle plus periodic completed-turn checks, byte-bounded exact-message selection, manual pinning, cancellation and disposal. RU/EN exact acknowledgments only; no semantic confirmation classifier.
- Root build/verify passed (exit 0): 306 tests, 9 existing scale skips; type checks, loader, declarations and isolated installed consumer passed. Companion final verify passed (exit 0): 11 tests, including real native title-service manual-rename race and queued/in-flight cancellation. Companion pack dry-run confirms JS/declarations/README/license. No live LLM call.
- Initial type/fixture failures (Modal closeLabel, native surfaceOp) corrected; review found and fixed special-key icon rename and queued-check cancellation. No hidden test skips added to required suites.
- Focused verification/security evidence and untested limits: [review](semantic-titles-folder-icons-review.md).
- Delivery remains source/packages, not activation. Icons require matching Host+Client (0.2.0 compatibility build before live use); companion requires separately approved provider replacement in the user-owned profile. No restart, deployment, or claim of browser visual acceptance.
