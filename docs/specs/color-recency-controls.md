# Visual color and recency controls

## Approved outcome
Follow-up to native sidebar design: user finds combined color/date menu inconvenient and asks for clearer icons. Replace tall combined list with two independent compact selectors: color palette (All + 8 presets in 3-column labelled grid) and period (Any time / 24h / 7d / 30d, clock/calendar icons). Current selection visible on triggers. No new filter semantics, custom dates, dependencies, core/auth/provider changes or restart.

## Design / scope
Native DSH reference; ENERGY 1 / RHYTHM 1 / MOTION 1. Reuse published Menu for portal placement, Escape/outside dismissal and keyboard navigation. CSS grid scoped by content marker, since canonical 0.1.5 Menu has no listClassName prop. Use existing bundled palette icon and native clock; calendar made only from basic geometric strokes with 7/30 labels. Color labels + explicit selection avoid color-only meaning. Use All colors rather than misleading Default (null disables filter). One shared reset remains above tree, no menu reset footer. Each selection applies immediately, closes menu, preserves other filters.

## Acceptance
Canonical build + verify, DOM tests for independent selections/preservation/selection labels. Exact rc2 preparation includes new component icon adaptation. Actual browser: all nine colors/four periods choose and persist; keyboard/Escape/outside; screenshots dark/light; narrow viewport and touch targets >=44; contrast measured for new text. Compare served bytes with candidate; preserve preferences. Back up exact existing registered client path, HMR-publish candidate plus update active extension to survive next launch. No service restart or new server. Commit/push dedicated branch.

## Candidate evidence
Canonical build/verify passed after new independent-menu tests (340 tests, 9 existing skips). Exact published rc2 typecheck/build and real installed loader passed. Native browser candidate verified 3-column palette, all 9 colors and all 4 periods persisted without changing other fields, native Arrow/Escape and outside dismissal; original preferences restored. Artwork is existing bundled palette/native clock plus basic inline calendar SVG: image generation not needed for tiny functional vector UI icons. Baseline sessionId pageerror unchanged.

## Visual check adjustment
Touch geometry passed (44px+ controls, 22px swatches), but first contrast evaluator wrongly treated transparent native material as black. Give only these two menus an explicit host semantic surface so actual foreground/background ratio is measurable; do not report the invalid transparent-background ratio. Rebuild, publish and recheck both themes before completion.

## Final verification
Live client HMR published the candidate into both registered and next-launch extension paths, with backups. Actual served bytes equal final candidate (SHA256 f58d72c45ee0658809aa2f8d3874238ba54184757add4743a9c4efe70e58a632). Native dark/light browser checked widths 240/280, controls/period rows >=44px under coarse pointer and swatches >=22px. Text contrast on explicit semantic menu surface: 15.03:1 dark, 18.90:1 light (palette labels, not whole-app certification). All nine colors and four periods preserved other settings, outside/Escape dismissal passed; preferences restored. Service PID 2359515/start 12:11:37 unchanged; no restart/core/auth changes. Canonical 340 tests pass, nine existing skips; real-loader and isolated package-consumer pass. Existing sessionId pageerror unchanged.

## Unknowns
Native Menu Arrow navigation is linear in grid, intentionally retained rather than custom keyboard framework. Live client registry retains oldest same-package source; use known client-hmr artifact watcher and verify actual revision. Pre-existing sessionId pageerror excluded, compare baseline. Design-system folder has README/tokens but missing discovery SKILL marker; add short marker describing same already-approved native reference, no style decision repeated.
