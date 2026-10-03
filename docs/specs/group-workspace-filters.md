# Group/workspace filters and safe folder icon interaction

## Intent and authorized scope
Refactor the existing DSH sidebar plugin: group and workspace filters show only display names with their folder icons; tapping a folder icon must not start editing. Retain the established DSH visual language (utilitarian, ENERGY 1 / RHYTHM 1 / MOTION 1). No new dependencies, core changes, deployment, server replacement or restart.

## Research and decision
Reference: https://help.tableau.com/current/pro/desktop/en-gb/filtering.htm (single-value dropdowns, relevant hierarchical values, additive filters, explicit reset). Extend the existing DSH Menu primitive: it already supplies icon slots, selected values, portal positioning, scroll limits and keyboard navigation. Native select cannot reliably display bundled SVG icons. Use single selection, as in the current workspace filter; multi-select is out of scope.

## Behavior / invariants
- Separate Group and Workspace dropdowns; options and selected triggers show icon + display name, not directory paths. Existing manual icon/color settings apply; standard folder icons are the fallback.
- Group scope includes All groups and Top level (ungrouped). Workspace choices depend only on group scope, not status/color/time, so transient session states cannot remove navigation choices.
- Changing groups preserves a compatible selected workspace; clears an incompatible one. Group + workspace + color + recency intersect; status counts are calculated within that context before status selection.
- Apply the same scopes to normal tree and search. Preserve attention handling, child-session retention, ordering, existing expansion state and Host request/authentication gates.
- Persist groupKey in existing profile filter preferences, with backward-compatible missing-field defaults and bounded validation. Remove stale scopes only once config/workspace loading succeeded.
- Folder icons are non-interactive spans: clicks bubble to row expansion. Editing is an explicit existing row-menu action, on desktop and touch alike. No alternate hover, long-press or double-click editing.
- Use existing tokens/focus states; dropdown triggers, choices and row menu targets at least 44px on touch; no horizontal overflow.

## Verification
Unit tests: group/top-level intersection and counts; persisted old/new contracts and malformed inputs. DOM tests: dropdown icons/names (no paths), dependent options, reset/persistence, search intersection, stale/loading protection, icon tap toggles without editor, explicit menu editing remains. Run pnpm build then pnpm verify (real loader and consumer included); direct changed-code review and browser exercise where possible. Commit only task-owned sources, tests, docs and synchronized lib outputs on a dedicated branch, push to origin.

## Delivery limits
Repository compatibility target remains DSH 0.1.5-rc.2. A new Host field requires an explicitly approved deployment before working in the currently served plugin; a Git push is not deployment. Live served UI testing does not certify the changed repository unless the actual bundle matches. Browser rendering/contrast limitations must be reported, not inferred from DOM tests.

## Status and evidence
Implemented group/workspace dropdowns using the existing Menu, persisted bounded groupKey with legacy defaults, applied intersection/counts to tree and search, and made folder icons decorative row targets. English/Russian/Chinese README behavior is aligned; generated lib artifacts rebuilt.

Final checks: pnpm build succeeded; pnpm verify passed (20 test files, 336 tests passed, 9 existing opt-in scale tests skipped), real-loader regression and isolated tarball consumer checks passed; git diff --check passed. DOM tests cover custom icons, no paths, group-dependent options, compatible/incompatible selection, top-level scope, persistence/reset/loading, search intersection, ordinary icon tap and explicit menu editing. A separate test executes the exact published Menu region with React (styles/decorative host icons stubbed), covering portal selection, ArrowDown focus, Escape and All reset. This package omits its standalone runtime dependencies, so direct primitive import is not a runnable test fixture; no dependency was added.

Changed-code review corrected the filter fast path, distinct top-level scope key, portal-specific CSS targeting, and group ordering. Existing Host authentication/request validation remains unchanged except allowing the bounded preference field.

Browser tab access timed out; actual browser rendering, contrast, native mobile input and the live authenticated lifecycle were not verified. No DSH deployment/restart was performed; the active UI is unchanged. Full served-bundle verification remains a separately approved deployment step.
