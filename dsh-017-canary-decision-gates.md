# DSH 0.1.7-rc.2 Canary Decision Gates

> Staged actionable gates preserving 14 active bundles in profile `web-015`.
> Each gate has a GO/NO-GO verdict. No gate authorizes the next; each requires separate operator consent.

**Source artifacts:**
- [`spec-dsh-upgrade-017-v2.md`](spec-dsh-upgrade-017-v2.md) — upgrade spec (phases A–D, invariants)
- [`dsh-017-readonly-compatibility.json`](dsh-017-readonly-compatibility.json) — static compatibility matrix (14 bundles, SHA `0677208c…`)
- [`dsh-017-readonly-audit.md`](dsh-017-readonly-audit.md) — confirmed static blockers and per-plugin audit
- [`dsh-017-independent-risk-review.md`](dsh-017-independent-risk-review.md) — independent Opus risk review with corrected findings
- [Official 0.1.7-rc.2 release notes](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.1.7-rc.2) (GitHub, immutable prerelease, published 2026-09-24)
- [Official 0.1.7-rc.1 release notes](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.1.7-rc.1) (GitHub, immutable prerelease, published 2026-09-23 — cumulative since 0.1.5-rc.3)

**Target:** `@deepseek-ai/dsh@0.1.7-rc.2` — npm dist-tag `next`, Git tag `dsh-v0.1.7-rc.2`, commit `477b4f420553e8a52c2fbccc464d7561b239c443`.
**Current:** Host `0.1.5-rc.2`, profile `web-015`, Node `v22.23.2`, pnpm `11.22.0`.

---

## Gate A — Read-Only Source Inventory

**Status: SAFE TO DO NOW. No operator choice required.**

This gate is purely read-only: inspect sources, compare APIs, produce this document. No installs, no boots, no data access.

### A.1 Confirmed Static Blockers (must resolve before any Gate B work)

| ID | Bundle | Blocker | Evidence |
|---|---|---|---|
| **BLOCK-1** | `dsh-session-persistence-jsonl-cache` 0.1.5-rc.2-homelab.1 | 3 exact-pinned DSH peers (`0.1.5-rc.2`) fail `evaluatePluginCompatibility` → bundle **skipped before import** in the normal unexempted path (no Host crash; JSONL caching silently absent). If exempted via `dsh plugin allow-version`, the bundle imports and the internal `=== '0.1.5-rc.2'` string guard (`lib/index.js:7–11`) **throws at module evaluation** against 0.1.7 versions. Either path leaves JSONL caching non-functional without a rebuild. | Audit §1.1; Risk-Review HS-1; `profile.ts` skip semantics |
| **BLOCK-2** | `@openviking/dsh-memory-plugin` 0.5.1 | `agent/session-start` event removed in 0.1.7 → replaced by async `agent/created`. Listener at `index.mjs:33` silently never fires: memory/skills injection stops working | Audit §1.2; Risk-Review YR-1; Release notes rc.1 Chores: "Replace `agent/session-start` with asynchronous, serial `agent/created`" |

### A.2 Semver Peer Mismatch (bundles with DSH peers only — not all 14)

Not all 14 bundles declare `@deepseek-ai/dsh*` peer dependencies. Several have no DSH peers and pass `evaluatePluginCompatibility` trivially (function returns `undefined`): `dsh-cpamc-limits` (zero peerDependencies), `dsh-ai-egress` (only `@deepseek-ai/cordis`, no `dsh-*`), `@dipertq/dsh-openviking-status` (only `react`/`react-dom`), `dsh-review-policy` (no DSH peers), `@deepseek-ai/dsh-base` (no DSH peers). `@deepseek-ai/dsh-web-app` has 2 caret DSH peers (`^0.1.5-rc.2`) which pass with `includePrerelease: true`. `dsh-fleet-cleaner` has `@deepseek-ai/dsh-host-webserver: >=0.1.0 <0.2.0` (open range, passes with `includePrerelease: true`).

For bundles that **do** declare DSH peers: standard npm/pnpm semver (without `--include-prerelease`) rejects all ranges against `0.1.7-rc.2` (prerelease tuple `0.1.7` ≠ `0.1.5`). The 0.1.7 `profile.ts` iterates every name in `dsh.profile.bundles` (all 14 including out-of-tree) and calls `evaluatePluginCompatibility(...)` per bundle with `includePrerelease: true` — bundles with caret/open ranges **pass** the runtime gate and will not be skipped. Bundles with exact-pinned peers **fail** the runtime gate and are skipped unless granted a version exemption via `dsh plugin allow-version`. At pnpm install time, `autoInstallPeers: false` is set; `strict-peer-dependencies` is not explicitly configured — exact install-time behavior (warnings vs hard fail) should not be assumed without testing.

### A.3 Feature Preservation Inventory (14 Bundles)

| # | Bundle | Version | Feature at Risk | Gate A Verdict |
|---|---|---|---|---|
| 1 | `@deepseek-ai/dsh-base` | core 0.1.5-rc.2 | Core runtime | Updates monolithically with DSH |
| 2 | `@deepseek-ai/dsh-web-app` | core 0.1.5-rc.2 | Web shell | Updates monolithically with DSH |
| 3 | `dsh-workspace-groups` | 0.1.1-local.20260924.1 | Sidebar grouping, drag-drop, tree search | 14 exact peers → **requires rebuild** |
| 4 | `dsh-cpamc-limits` | 0.1.1-local.20260924.3 | Quota/limits display | Zero peerDependencies; passes compatibility gate trivially; Cordis API validation needed |
| 5 | `dsh-client-ui-teratts` | 0.8.8-rc1.local.2 | TTS synthesis + audio cache | `getChunk` security gap (A.4); peer mismatch |
| 6 | `dsh-ai-egress` | 0.1.0 | AI egress routing | Only non-DSH peer (`@deepseek-ai/cordis ^4.0.1`); passes compatibility gate trivially; egress contract validation needed |
| 7 | `dsh-codex-auth` | 0.3.3-rc.1 | Codex auth + **local `manageEnvProxy` patch** | npm dist-tags: `latest`=0.3.2, `rc`=0.3.3-rc.1; local same-version install has proxy patch not in upstream tarball; rebuild must use a **new version** (e.g. `0.3.3-rc.2`, confirmed available but not reserved on npm); 3 exact peers (optional); `snapshotEvents()` present in 0.1.7 source (deprecated; runtime behavior untested) |
| 8 | `dsh-session-persistence-jsonl-cache` | 0.1.5-rc.2-homelab.1 | JSONL session cache | **HARD BLOCKER** (BLOCK-1) |
| 9 | `dsh-web-mobile` | 2.3.1-local.20260924.1 | Mobile layout + local swipe/zoom hacks | Upstream 3.0.3 requires Node ≥24; drops local hacks |
| 10 | `dsh-fleet-cleaner` | 0.2.0 | Fleet session cleanup | 1 DSH peer (`@deepseek-ai/dsh-host-webserver: >=0.1.0 <0.2.0`, open range, passes runtime gate); canary validation needed |
| 11 | `dsh-review` | 0.2.0 | Review campaigns | 12 exact peers; `snapshotEvents()` present in 0.1.7 source (deprecated; runtime behavior untested) |
| 12 | `dsh-review-policy` | 0.1.0 | Review config overlay | Depends on dsh-review functioning |
| 13 | `@dipertq/dsh-openviking-status` | 0.3.2 | OpenViking sidebar status | No DSH peers (only `react`/`react-dom`); passes compatibility gate trivially; pure React UI plugin |
| 14 | `@openviking/dsh-memory-plugin` | 0.5.1 | Long-term memory + skills injection | **FUNCTIONAL BLOCKER** (BLOCK-2) |

### A.4 TTS Per-Session Security Finding (Pre-existing)

`getChunk` (`dsh-client-ui-teratts/lib/index.js:220–233`) scans ALL sessions via `this.ctx.get("sessions")?.list()` to find a `messageId`. Exposed as `@Remote("getChunk")`. Browser authentication exists (`dsh-client-connection` signed-cookie HMAC + Host/Origin fence), but **no per-session ownership check**: an authenticated client with a known `messageId` can synthesize audio from any session's messages. This is a **pre-existing gap**, not introduced by migration. Cache is in-memory LRU only (4h TTL, 128MB cap) — no persistence risk.

### A.5 Key 0.1.7 API Changes Affecting Features (from release notes)

| Change | Affected Bundles | Severity |
|---|---|---|
| `agent/session-start` → async `agent/created` | #14 OpenViking memory | 🔴 Blocker |
| `snapshotEvents`/`eventAt`/`ownEvents` deprecated (present with `@deprecated` and full implementation in 0.1.7 **source**) | #7 codex-auth, #11 dsh-review, #14 OpenViking memory (`ownEvents` with fallback) | 🟡 Present in source; runtime behavior not independently tested; future removal risk |
| Session log V4 (format version 4, exact match enforced) | All session-touching bundles (#8 especially) | 🟡 One-way gate on rollback |
| Client Sessions multi-instance + slot changes | #3 workspace-groups, #9 mobile | 🟡 API surface review needed |
| Settings → Profile config (old `settings.yaml` imported once, renamed `.imported` — per release notes; exact migration fidelity untested) | All — settings mutation on first boot | 🟠 Irreversible on production `DSH_HOME`; exact field mapping unverified |
| `spill-policy.maxInlineBytes` → `maxInlineTokens` | Config-level | 🟡 Config migration |
| Plugin compatibility check + version exemptions | All 14 bundles checked; exact-pinned bundles skipped at boot | 🟡 Exact-pinned: exemptions or rebuilds required; caret/open ranges pass gate |
| Remote: `readBytes` replaces old file read API; binary/stream support | #5 TTS, #9 mobile | 🟡 API surface review |
| `workspace-groups` file read change: workspace file reads → `readBytes` | #3 workspace-groups (if using file reads) | 🟡 Source review needed |

---

## Gate B — Artifact Adaptation

**Status: REQUIRES OPERATOR CHOICE on 7 decisions before work begins.**
**Safe to do now (after choices): only builds new immutable versioned archives and tests. No live data, no boots, no credentials.**

### B.1 Decisions Required Before Any Build Work

#### B.1.1 — JSONL Cache Guard Strategy

The exact `===` guard must be resolved. Options:

| Option | Trade-off |
|---|---|
| **(a)** New build with guard widened to accept `0.1.7-rc.2` explicitly | Minimal change; still exact-version locked |
| **(b)** New build with semver range `>=0.1.5-rc.2 <0.2.0` | Flexible for future prereleases; requires V4 session API contract testing |
| **(c)** Remove guard entirely, rely on API-level testing | Most flexible; loses fail-fast safety net |

**Recommendation:** (b) with V4 contract tests in Gate C.

#### B.1.2 — Mobile Plugin: Local vs Upstream

| Option | Trade-off |
|---|---|
| **(a)** Keep `2.3.1-local` (local swipe/zoom hacks), rebuild peers for 0.1.7 | Preserves UX; Node 22 compatible; 0.1.7 API compatibility untested |
| **(b)** Adopt upstream `3.0.3` | Requires Node ≥24; **loses** composer-card swipe hacks (`sidebar-swipe.ts`, `gesture-guard.ts`) and force-zoom hacks (`phone-chrome.ts`, `misc.css.ts`, `layout.css.ts`); doubles blast radius |

**Note:** Current local mobile compatibility with 0.1.7 is **unknown/untested** — this is a read-only question until canary boot. Upstream v3.0.3 requires Node≥24 and intentionally diverges on local swipe/zoom.

**Recommendation:** (a) — rebuild local 2.3.1 with widened peers; test in canary. Upstream 3.0.3 is a separate future decision.

#### B.1.3 — Codex-Auth: Published vs Local Proxy Fix

| Option | Trade-off |
|---|---|
| **(a)** Rebuild from local `0.3.3-rc.1` source with widened peers under a **new version** (e.g. `0.3.3-rc.2`, confirmed not published on npm) | Preserves `manageEnvProxy` patch and `native-checkpoint`; `snapshotEvents()` works in 0.1.7 (deprecated-but-present). Must NOT reuse version `0.3.3-rc.1` — that version already exists on npm with different content (no proxy patch); publishing a different tarball under the same version is a registry collision. |
| **(b)** Revert to npm `latest` (0.3.2) or upstream `rc` (0.3.3-rc.1) | **Loses** local `manageEnvProxy` patch; breaks local Codex daemon routing |

**Recommendation:** (a) — rebuild from local source with `manageEnvProxy` patch under a new version number. `0.3.3-rc.2` is confirmed available on npm (not published as of 2026-09-25). The version `0.3.3-rc.1` must not be reused for a new tarball — the upstream npm tarball at that version has different content. Upstream npm versions (0.3.2 or 0.3.3-rc.1) lack the local proxy patch and are **NO-GO**.

#### B.1.4 — OpenViking Memory Plugin Event Migration

| Option | Trade-off |
|---|---|
| **(a)** Request upstream `@openviking/dsh-memory-plugin` update using `agent/created` | Clean; depends on upstream timeline — **preferred path** |
| **(b)** Operator-owned patch to existing installed package: `agent/session-start` → `agent/created` in `index.mjs:33` | Only after explicit operator approval; local maintenance burden |
| **(c)** **NO-GO** | If neither upstream nor operator patch is available, memory injection is non-functional under 0.1.7 |

**Note:** A local fork of the OpenViking package is explicitly excluded. Only upstream-supported update (a) or operator-owned existing-package patch (b) after user approval are valid paths.

**Recommendation:** (a) for production; (b) for canary only if operator approves.

#### B.1.5 — Workspace-Groups and Review Peer Strategy

| Option | Trade-off |
|---|---|
| **(a)** Rebuild both with widened peer ranges targeting `>=0.1.5-rc.1 <0.2.0` | Clean; requires build + test |
| **(b)** Grant version exemptions via `dsh plugin allow-version` for canary, rebuild for production | Faster canary; exemptions are a supported mechanism |

**Recommendation:** (a) for workspace-groups (this repository — controllable); (b) as interim for dsh-review if upstream rebuild is not available.

#### B.1.6 — TTS Per-Session Security

**Status: REQUIRES SEPARATE DESIGN — cannot call global `getChunk` safe**

The global `getChunk` scans all sessions and cannot be called secure. Preserving TTS caching behavior while adding session-scoped ACL requires a separate design effort; the two concerns are coupled in the current implementation.

**Read-only question:** Does the operator accept the pre-existing per-session ACL gap for this migration cycle, or does this require resolution before proceeding? Resolution requires a separate TTS security design document — not a simple option selection.

**Note:** This is a pre-existing gap (not introduced by migration). The gap is conditional on authenticated browser + known messageId (UUIDs — not easily enumerable). User explicitly requires preserving TTS caching/behavior.

#### B.1.7 — V4 Session Rollback Boundary

**Question:** If canary writes V4 session data to the copied test data, and migration is aborted, is the operator willing to discard all canary-written sessions? No verified downgrade path is available to this plan; do not assume rollback can preserve post-upgrade writes.

**Recommendation:** Yes — canary operates only on disposable copies. Original V3 data retained untouched.

### B.2 Build Artifacts Required (after operator choices)

All builds produce **new immutable versioned archives**. No existing artifacts are modified.

#### Confirmed rebuilds (source-level blockers verified)

| Bundle | Action | New Version (suggested, not reserved) | Test Requirements |
|---|---|---|---|
| `dsh-session-persistence-jsonl-cache` | Rebuild with new version guard + V4 contract validation | `0.1.7-rc.2-homelab.1` (suggested; must verify availability) | V4 session read/write smoke; JSONL format compatibility |
| `dsh-workspace-groups` | Rebuild with widened peers (this repository — operator-owned) | `0.1.2-local.YYYYMMDD.1` (suggested; must verify availability) | `pnpm verify`; loader acceptance under 0.1.7 |
| `dsh-review` | Rebuild with widened peers (exact-pinned, skipped at boot) | `0.2.1` (suggested; must verify availability) | `snapshotEvents()` in `approve()` — source-verified present; runtime canary test required; reviewer lifecycle |

#### Operator-approval-only rebuilds (local patch must be retained)

| Bundle | Action | New Version (suggested, not reserved) | Test Requirements |
|---|---|---|---|
| `dsh-codex-auth` | Rebuild from local `0.3.3-rc.1` source with widened peers under a **new version** — `manageEnvProxy` patch must be retained. Must not reuse `0.3.3-rc.1` (upstream npm tarball has different content). | `0.3.3-rc.2` (suggested; confirmed not published on npm as of 2026-09-25 but not reserved — verify before use) | `snapshotEvents()` — source-verified present; runtime canary test required; proxy routing; Codex CLI |
| `@openviking/dsh-memory-plugin` (if operator approves B.1.4b) | Operator-owned patch `agent/session-start` → `agent/created` + widen peers | `0.5.2-local.1` (suggested; must verify availability) | Memory injection; recall; skills catalog |

#### Read-only questions (boot/canary untested — no confirmed rebuild required)

These bundles' peer ranges pass the runtime `evaluatePluginCompatibility` gate (`includePrerelease: true`) and will not be skipped at boot. Whether they need a rebuild for API compatibility is unknown until canary testing.

| Bundle | Current Status | Read-only Question |
|---|---|---|
| `dsh-web-mobile` 2.3.1-local | Union ranges pass runtime gate; 0.1.7 API compatibility **untested** | Does v2.3.1-local load and function correctly under 0.1.7? |
| `dsh-client-ui-teratts` 0.8.8-rc1.local.2 | Caret ranges (`^0.1.0-rc.8`) pass runtime gate; TTS security is a separate design concern | Does TTS synthesis work with 0.1.7 session list API? |
| `dsh-cpamc-limits` 0.1.1-local.20260924.3 | Peer review needed | Does quota display work under 0.1.7? |
| `dsh-ai-egress` 0.1.0 | Peer review needed | Does egress routing load under 0.1.7? |
| `dsh-fleet-cleaner` 0.2.0 | Peer review needed | Does fleet cleanup function under 0.1.7? |

**Bundles requiring NO rebuild (canary verification still required before any 0.1.7 readiness claim):**
- `dsh-review-policy` 0.1.0 — config overlay; depends on dsh-review functioning under 0.1.7
- `@dipertq/dsh-openviking-status` 0.3.2 — pure React UI; no known core API dependencies; untested under 0.1.7
- `@deepseek-ai/dsh-base` + `dsh-web-app` — in-box core; updates monolithically with DSH

---

## Gate C — Isolated Synthetic Canary

**Status: NO-GO until Gate B artifacts exist and pass their unit tests.**
**Requires SEPARATE OPERATOR PERMISSION. No live credentials, no live sessions.**

### C.1 Canary Environment Requirements

| Requirement | Rationale |
|---|---|
| Separate `DSH_HOME` (e.g. `/tmp/dsh-017-canary`) | Prevent ANY write to production data |
| Separate profile directory (NOT `web-015`) | Avoid settings mutation (`settings.yaml` → `.imported`) |
| Separate HTTP port and Host/Origin | Prevent production browser cookie leakage |
| Synthetic auth only (disposable tokens) | No live API keys or credentials |
| Pinned Node version + pnpm lockfile | Reproducible; Node 22 unless mobile 3.0.3 chosen |
| No mounts/links to production session data | V4 writes must not touch production JSONL |
| Synthetic test sessions only (Gate C) | Real session copies only in Gate D with separate consent |
| Version exemptions configured for all rebuilt bundles | Or rebuilt bundles with correct peer ranges |

### C.2 Canary Smoke Tests (14 bundles)

| Test | Covers Bundles | Pass Criteria |
|---|---|---|
| Host boots without crash | ALL (especially #8 JSONL cache) | Zero fatal exceptions in Cordis init |
| All 14 bundle layers load (not skipped) | ALL | `skippedBundles` is empty; `pluginCompatibilityWarning` not emitted |
| Sidebar workspace grouping renders | #3 workspace-groups | Tree renders; drag-drop works; search filters |
| Mobile layout (if included) | #9 mobile | Swipe/zoom behavior matches 2.3.1-local |
| Codex CLI integration | #7 codex-auth | `codex` command reachable; `manageEnvProxy: false` respected |
| TTS synthesis plays audio | #5 TTS | `getChunk` returns audio for synthetic session message |
| Memory injection fires on agent start | #14 OpenViking memory | `agent/created` handler runs; skills catalog injected |
| Review campaign lifecycle | #11 review, #12 review-policy | `review_plan` → `review_start` → `review_status` succeed |
| Fleet cleanup hook | #10 fleet-cleaner | Hook registered; synthetic cleanup runs |
| Quota/limits display | #4 cpamc-limits | UI renders quota data |
| AI egress routing | #6 ai-egress | Egress configuration loads |
| OpenViking status sidebar | #13 openviking-status | Status widget renders |
| `snapshotEvents()` deprecation warning | #7 codex-auth, #11 review | Method returns data; deprecation warning logged (not crash) — source-verified present in 0.1.7; canary confirms runtime behavior |
| `spill-policy.maxInlineTokens` config | Settings | New config key accepted; old `maxInlineBytes` rejected or migrated |
| Client Session multi-instance | #3 workspace-groups | Multiple session tabs open without conflict |

### C.3 Canary NO-GO Criteria

Any of these stops canary and returns to Gate B:
- Any bundle in `skippedBundles` (loader rejected it)
- JSONL cache skipped or crash (BLOCK-1 not resolved — skipped in normal path; throws if exempted without rebuild)
- Memory plugin silent failure (BLOCK-2 not resolved)
- Session data written to production `DSH_HOME`
- Production credentials used or accessible
- Unresolvable API incompatibility in any of the 14 bundles

---

## Gate D — Copied-History Migration and Rollback

**Status: NO-GO until Gate C passes all smoke tests.**
**Requires SEPARATE OPERATOR CONSENT for each sub-step. Never touches originals.**

### D.1 Pre-Migration Snapshot

| Item | Action |
|---|---|
| Production profile manifest + lockfile | Copy + SHA-256 verification |
| All 14 bundle tgz artifacts (original versions) | Archive for rollback |
| `settings.yaml` (original) | Copy before any 0.1.7 boot (0.1.7 renames it irreversibly) |
| `node_modules` state | Full snapshot or reproducible lockfile |
| Session JSONL data (encrypted copy) | **With explicit consent only**; never symlink/hardlink originals |

### D.2 Session Format Migration Test

1. Create encrypted copy of selected production sessions (with consent)
2. Boot canary with copied sessions in separate `DSH_HOME`
3. Verify V3 → V4 migration pipeline:
   - Sessions open and display correctly
   - V4 headers written; V3 originals unchanged in the copy
   - `snapshotEvents()` returns correct data on migrated sessions
4. **Verify rollback**: discard canary `DSH_HOME`; boot original profile on 0.1.5-rc.2; confirm all original sessions load

### D.3 Settings Migration Test

1. Copy `settings.yaml` into canary `DSH_HOME`
2. Boot 0.1.7 canary — observe `settings.yaml` → `settings.yaml.imported` rename
3. Verify all settings correctly transferred to Profile config (exact field mapping and value preservation must be checked — not assumed from release notes)
4. Verify `spill-policy.maxInlineBytes` → `maxInlineTokens` migration (described in release notes; exact conversion logic unverified)

### D.4 Rollback Plan

| Scenario | Recovery |
|---|---|
| Canary fails, no production writes | Discard canary `DSH_HOME`; production unchanged |
| Production cutover fails before session writes | Restore original profile manifest + lockfile + `node_modules` + `settings.yaml`; original bundle tgzs |
| Production cutover fails after V4 session writes | **Cannot downgrade V4 → V3**. Restore from D.1 snapshot: original session data + complete runtime. V4-written sessions are lost. **Caution:** whether 0.1.7 silently upgrades V3 → V4 on *read* (not just explicit write) is unverified — the persistence layer owns storage writes and was not inspected in its 0.1.7 form (see Risk-Review YR-4). If read-triggered upgrade occurs, even opening old sessions in canary could prevent rollback to V3 for those sessions. |

### D.5 Gate D NO-GO Criteria

- Session migration produces corrupt or unreadable sessions
- Settings migration loses any active setting
- Rollback drill fails (0.1.5-rc.2 cannot boot cleanly after discarding canary data)
- Any write to production data without explicit consent

---

## Gate E — Production Cutover

**Status: NO-GO until Gate D passes, including rollback drill.**
**Requires SEPARATE OPERATOR APPROVAL. Requires separately approved one-use `dsh-web.service` restart.**

### E.1 Pre-Cutover Checklist

- [ ] Gate A: source inventory complete and documented
- [ ] Gate B: all required rebuild artifacts produced, versioned, and unit-tested
- [ ] Gate C: canary passed all 15 smoke tests with zero `skippedBundles`
- [ ] Gate D: session migration tested on copy; rollback drill passed; settings migration verified
- [ ] All 14 bundles confirmed loading in correct `bundle_order`
- [ ] TTS security decision documented (B.1.6)
- [ ] Mobile plugin decision documented (B.1.2)
- [ ] D.1 snapshot archived and SHA-verified
- [ ] Sessions drained (no active agent/worker sessions)
- [ ] One-use `dsh-web.service` restart explicitly approved

### E.2 Cutover Sequence (requires live approval at each step)

1. Drain all active sessions; confirm no background jobs running
2. Create production snapshot (D.1)
3. Swap profile to new manifest with rebuilt bundles
4. Approved one-use `dsh-web.service` restart (per `homelab` skill procedure)
5. Post-restart verification:
   - All 14 bundles loaded (not skipped)
   - Existing sessions readable (V3 → V4 migration)
   - Settings intact
   - TTS, mobile, codex, memory, review, fleet, workspace-groups functional
   - Web authentication unchanged
6. Monitor for 1 hour; rollback if any NO-GO criterion met

### E.3 Gate E NO-GO Criteria

- Any bundle skipped or crashed at boot
- Session data corruption or loss
- Settings loss
- Authentication failure
- Any feature from the 14-bundle inventory non-functional without documented acceptance
- Rollback snapshot not verified before cutover begins

---

## Summary: What Can Be Done Now vs Needs Operator Choice

### ✅ Safe to Do Now (No Operator Choice Needed)

| Action | Gate |
|---|---|
| This document (read-only research, source inventory) | A |
| Read and compare 0.1.7 source APIs against installed plugins | A |
| Verify `snapshotEvents()`/`ownEvents()` presence in 0.1.7 source (already done: deprecated-but-present) | A |
| Verify semver behavior with `npx semver` (already done: all fail without `--include-prerelease`) | A |
| Verify npm registry state for codex-auth (already done: dist-tags `latest`=0.3.2, `rc`=0.3.3-rc.1) | A |

### ⚠️ Requires Operator Decision Before Work

| Decision | Gate | Options | Ref |
|---|---|---|---|
| JSONL cache guard strategy | B | (a) exact 0.1.7, (b) semver range, (c) remove guard | B.1.1 |
| Mobile: local 2.3.1 vs upstream 3.0.3 | B | (a) keep local, (b) upgrade+Node24 | B.1.2 |
| Codex-auth: rebuild from local source under new version with `manageEnvProxy` patch | B | (a) rebuild under new version (e.g. `0.3.3-rc.2`), **(b) NO-GO** — upstream lacks patch; must not reuse `0.3.3-rc.1` for a different tarball | B.1.3 |
| OpenViking memory: upstream update vs operator patch | B | (a) upstream, (b) operator patch, (c) NO-GO | B.1.4 |
| Workspace-groups/review peer strategy | B | (a) rebuild, (b) version exemptions | B.1.5 |
| TTS per-session security | B | Read-only question — requires separate design | B.1.6 |
| V4 rollback boundary (discard canary sessions?) | B | Yes/No | B.1.7 |
| Canary environment creation permission | C | Approve / Deny | C |
| Copied session data access consent | D | Approve / Deny per dataset | D |
| Production cutover + restart approval | E | Approve / Deny | E |

### 🔴 Risks and Absolute NO-GOs

| Risk | Severity | Mitigation |
|---|---|---|
| Booting 0.1.7 on production `DSH_HOME` before canary | 🔴 **Absolute NO-GO** | Settings mutation + V4 writes are irreversible |
| Using upstream npm codex-auth (0.3.2 or 0.3.3-rc.1) instead of a local rebuild with `manageEnvProxy` patch | 🔴 **NO-GO** | Local proxy patch absent in upstream; breaks Codex daemon routing. Must not reuse version `0.3.3-rc.1` for a rebuilt tarball — registry collision with different content. |
| Copying live credentials into canary | 🔴 **NO-GO** | Canary uses synthetic/disposable auth only |
| Symlinking production sessions into canary | 🔴 **NO-GO** | V4 writes would corrupt production data |
| Restarting `dsh-web.service` without explicit one-use approval | 🔴 **NO-GO** | Interrupts all active sessions |
| Upgrading to mobile 3.0.3 without Node ≥24 | 🔴 **NO-GO** | `engines: { node: '>=24.0.0' }` constraint |
| Assuming 0.1.7 loader behavior from 0.1.5 loader inspection | 🟠 **Risk** | 0.1.7 adds `evaluatePluginCompatibility` gate not present in 0.1.5 |
| `snapshotEvents()` removal in post-0.1.7 release | 🟡 **Future risk** | Present in 0.1.7 source (`@deprecated` with full implementation); runtime behavior not independently tested; codex-auth and review must migrate before next upgrade |
| TTS `getChunk` per-session ACL gap | 🟠 **Pre-existing** | Cannot call global `getChunk` safe; preserving TTS caching with session ACL requires separate design |
| Local fork of OpenViking memory plugin | 🔴 **NO-GO** | User explicitly excludes fork; upstream update or operator-owned existing-package patch only |
| V4 session format one-way gate | 🟡 **By design** | Rollback requires retaining original V3 data; no V4→V3 downgrade. Whether 0.1.7 upgrades V3→V4 on *read* (not just explicit write) is unverified — the persistence layer was not inspected in 0.1.7 form (see Risk-Review YR-4). A V4→V3 downgrade tool has not been confirmed to exist or not exist. |

---

*Generated 2026-09-25. Corrected 2026-09-25T21:10Z. Precision corrections 2026-09-25T21:38Z: JSONL cache skip-before-import semantics, per-bundle peer accuracy, snapshotEvents source-only caveat, version-number availability caveat, settings migration precision. Read-only research; no packages installed, no builds run, no processes started, no files modified beyond this document.*
