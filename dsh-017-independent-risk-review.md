# Independent Risk Review: DSH 0.1.5-rc.2 → 0.1.7-rc.2

> **TL;DR:** One confirmed functional blocker affects migration (JSONL cache: 3 exact-pinned DSH peers cause the bundle to be **skipped before import** in the normal unexempted path — no Host crash, but JSONL caching silently absent; if exempted via `dsh plugin allow-version`, the internal `=== '0.1.5-rc.2'` guard **throws** at module evaluation). The 0.1.7-rc.2 runtime bundle gate (`evaluatePluginCompatibility` in `plugin-compatibility.ts`) uses `semver.satisfies` with `includePrerelease: true` — caret and open peer ranges pass; only exact-pinned versions fail. Not all 14 bundles declare DSH peers: several (dsh-cpamc-limits, dsh-ai-egress, openviking-status, review-policy, dsh-base) have no `@deepseek-ai/dsh*` peers and pass the gate trivially. This gate iterates every name in `dsh.profile.bundles` (all 14 including out-of-tree) and calls `evaluatePluginCompatibility(...)` per bundle; incompatible bundles are **skipped** at boot with a diagnostic, not crash-causing. Standard pnpm semver (without `includePrerelease`) applies at install time; the profile sets `autoInstallPeers: false` and `strict-peer-dependencies` is not explicitly configured — exact install-time behavior (warnings vs hard fail) should not be assumed without testing. Mobile v3.0.3's Node≥24 `engines` constraint is avoidable by keeping the installed v2.3.1-local (its API compatibility with 0.1.7 is unknown); upstream v3.0.3 also intentionally diverges on swipe/zoom behavior. npm `dsh-codex-auth@0.3.3-rc.1` exists on the registry (dist-tags: `latest`=0.3.2, `rc`=0.3.3-rc.1); the local same-version install has a proxy patch (`manageEnvProxy`, `native-checkpoint`) that must be retained — it is not in the upstream tarball; a rebuild must use a new version (e.g. `0.3.3-rc.2`, suggested but not reserved). `snapshotEvents()` and `ownEvents()` are both present in 0.1.7 source `@deprecated` with full implementation (exact text: *"Existing logic may remain unmigrated for now, but new calls are prohibited"*); runtime behavior not independently tested — source inspection only. The 0.1.7 `SessionStore.fork()` itself uses `snapshotEvents()` with a lint suppression. The TTS `getChunk` cross-session scan is a per-session ACL gap — `dsh-client-connection` does enforce signed-cookie browser authentication, so the issue is not anonymous exposure but missing per-session ownership within an authenticated context; it cannot be called secure. The OpenViking memory `agent/session-start` listener will silently stop. Multiple user decisions required before canary staging.

**Reviewed:** 2026-09-25T19:52Z  
**Corrected:** 2026-09-25T21:13Z (third correction pass: codex-auth version collision warning, HS-3 pnpm claim precision, YR-2 rebuild version note). Precision corrections 2026-09-25T21:41Z: HS-1 skip-before-import semantics (not mandatory Host crash), per-bundle peer accuracy (not all 14 have DSH peers), snapshotEvents source-only caveat (runtime untested), version-number availability caveat.  
**Reviewer:** Independent Opus agent (no access to prior worker reports)  
**Scope:** Read-only inspection of installed profile `web-015`, runtime `v015-rc2-t4x7mz4n`, npm registry metadata, filed spec/audit artifacts, **and** official 0.1.7-rc.2 GitHub source (`plugin-compatibility.ts`, `profile.ts`, `session/src/index.ts`)  
**Source artifacts inspected:**
- `/var/lib/dsh/Project/dsh-workspace-groups/spec-dsh-upgrade-017-v2.md`
- `/var/lib/dsh/Project/dsh-workspace-groups/dsh-017-readonly-compatibility.json`
- Runtime: `/var/lib/dsh/.dsh-releases/v015-rc2-t4x7mz4n/runtime/`
- Profile: `/var/lib/dsh/.dsh/profiles/web-015/node_modules/` (+ `pnpm-workspace.yaml`)
- npm registry: `@deepseek-ai/dsh@0.1.7-rc.2`, `@deepseek-ai/dsh-session@0.1.7-rc.2`, `dsh-web-mobile@3.0.3`, `dsh-codex-auth@0.3.3-rc.1`
- GitHub source (tag `dsh-v0.1.7-rc.2`): `packages/boot/app-boot/src/plugin-compatibility.ts`, `packages/boot/app-boot/src/profile.ts`, `packages/core/session/src/index.ts`

---

## 1. Hard Stop and Install-Time Constraints (must resolve before migration work)

### HS-1: JSONL cache exact version guard — skipped before import in normal path; throws only after exemption

**Status: CONFIRMED FUNCTIONAL BLOCKER (not a boot crash in the normal unexempted path)**

File: `/var/lib/dsh/.dsh/profiles/web-015/node_modules/dsh-session-persistence-jsonl-cache/lib/index.js`, lines 7–11

```js
const SUPPORTED_DSH_VERSION = '0.1.5-rc.2';
// ...
if (sessionManifest.version !== SUPPORTED_DSH_VERSION || jsonlManifest.version !== SUPPORTED_DSH_VERSION) {
    throw new Error(`dsh-session-persistence-jsonl-cache requires DSH ${SUPPORTED_DSH_VERSION}; ...`);
}
```

This is a strict `!==` string comparison against imported `package.json` versions of `@deepseek-ai/dsh-session` and `@deepseek-ai/dsh-session-persistence-jsonl`. **However**, this code only executes if the bundle is actually imported. The 0.1.7 boot sequence in `profile.ts:loadProfileDirectory` calls `evaluatePluginCompatibility` on each bundle's `package.json` manifest **before** importing any module code. The JSONL cache bundle declares 3 exact-pinned DSH peers (`0.1.5-rc.2`) which fail `semver.satisfies` with `includePrerelease: true` → the bundle is **skipped** (added to `skippedBundles` with a diagnostic) and its code is **never imported**. The `throw` at lines 7–11 never executes in the normal unexempted path.

**If the bundle is granted a version exemption** via `dsh plugin allow-version` (bypassing the peer gate), the module code imports and the `===` guard **does throw**, crashing the Host at module evaluation time.

**Net effect in both paths:** JSONL caching is non-functional under 0.1.7 without a rebuild. The normal path silently loses caching (skip); the exempted path crashes (throw).

**Required action:** A new build of `dsh-session-persistence-jsonl-cache` with updated version guard (and tested against 0.1.7 session/JSONL APIs) must be produced and verified before canary boot.

### HS-2: Node v22 vs upstream mobile v3.0.3 `engines: { node: '>=24.0.0' }`

**Status: CANDIDATE-ONLY CONSTRAINT — not a hard stop for migration**

```
Current Node: v22.23.2
dsh-web-mobile@3.0.3 on npm: engines.node = '>=24.0.0'
```

Verified via `npm view dsh-web-mobile@3.0.3 engines` → `{ node: '>=24.0.0' }`.

The currently installed mobile plugin is `v2.3.1-local.20260924.1` which has **no** `engines` field and runs on Node 22. The Node≥24 constraint applies only if upgrading to v3.0.3; keeping the installed v2.3.1-local avoids this entirely. **However, v2.3.1-local's API compatibility with 0.1.7 is unknown** — it was built against 0.1.5 and may use APIs that changed. Its 9 DSH peer ranges all use union ranges (`^0.1.0-rc.6 || >=0.1.1-rc.0 <0.2.0 || >=0.1.2-a <0.2.0`) that **pass** `semver.satisfies` with `includePrerelease: true`.

**Upstream behavioral divergence:** npm `dsh-web-mobile@3.0.3` description is "尽可能的使dsh适配竖屏等移动端设备" (adapt DSH for portrait/mobile devices). Upstream v3.0.3 intentionally diverges from the local v2.3.1 build on swipe and zoom behavior — the local build preserves original touch gestures while v3.0.3 implements upstream's own mobile interaction model. Upgrading to v3.0.3 would change user-facing touch interaction, independent of the Node constraint.

**Also note:** npm `dsh-codex-auth@0.3.3-rc.1` declares `engines: { node: '^22.19.0 || >=24.0.0' }`, which is satisfied by current Node v22.23.2. This is not a constraint for codex-auth.

**Decision required:** (a) Stay on v2.3.1-local and verify against 0.1.7 APIs independently (avoids Node constraint and preserves current touch behavior, but compatibility untested), OR (b) upgrade Node to ≥24 and adopt v3.0.3 (doubles blast radius, changes swipe/zoom behavior). Current local mobile compatibility with 0.1.7 is **unknown** — this is a read-only question until canary boot.

### HS-3: Semver prerelease peer-range satisfaction — two different gates

**Status: CORRECTED — not all 14 bundles have DSH peers; standard npm semver rejects all DSH-peer ranges; 0.1.7 runtime gate uses `includePrerelease: true` and passes caret/open ranges**

The prior report's claim "all 14 peers fail" conflated two distinct evaluation contexts and overstated scope. Five bundles have **zero** `@deepseek-ai/dsh*` peer dependencies and pass `evaluatePluginCompatibility` trivially (function returns `undefined`): `dsh-cpamc-limits` (no peerDependencies), `dsh-ai-egress` (only `@deepseek-ai/cordis`), `@dipertq/dsh-openviking-status` (only `react`/`react-dom`), `dsh-review-policy` (no DSH peers), `@deepseek-ai/dsh-base` (no DSH peers).

#### 3a. Standard npm/pnpm semver (default `includePrerelease: false`)

| Range | Version | Result |
|---|---|---|
| `^0.1.5-rc.1` | `0.1.7-rc.2` | ❌ FAIL |
| `0.1.5-rc.2` (exact) | `0.1.7-rc.2` | ❌ FAIL |
| `^0.1.0-rc.8` | `0.1.7-rc.2` | ❌ FAIL |
| `>=0.1.0-rc.6 <0.2.0 \|\| ^0.1.5-rc.1` | `0.1.7-rc.2` | ❌ FAIL |

All ranges fail. Root cause: prerelease versions only satisfy ranges sharing the same `[major.minor.patch]` tuple.

#### 3b. 0.1.7-rc.2 runtime bundle gate (`includePrerelease: true`)

The `evaluatePluginCompatibility` function in `plugin-compatibility.ts` hardcodes `{ includePrerelease: true }`:

| Range | Version | Result |
|---|---|---|
| `^0.1.5-rc.1` | `0.1.7-rc.2` | ✅ PASS |
| `0.1.5-rc.2` (exact) | `0.1.7-rc.2` | ❌ FAIL |
| `^0.1.0-rc.8` | `0.1.7-rc.2` | ✅ PASS |
| `>=0.1.0-rc.6 <0.2.0 \|\| ^0.1.5-rc.1` | `0.1.7-rc.2` | ✅ PASS |
| `^0.1.0-rc.6 \|\| >=0.1.1-rc.0 <0.2.0 \|\| >=0.1.2-a <0.2.0` | `0.1.7-rc.2` | ✅ PASS |

**Only exact-pinned versions fail at this gate. All caret and open ranges pass.**

#### Corrected per-plugin impact

| Plugin | DSH peers | Range types | Runtime gate (includePrerelease) | pnpm install (standard) | Gate applies? |
|---|---|---|---|---|---|
| dsh-workspace-groups | 14 | 14 exact `0.1.5-rc.2` | ❌ 14/14 fail | ❌ 14/14 fail | Yes |
| dsh-codex-auth | 28 | 3 exact + 25 caret `^0.1.5-rc.1` | ❌ 3 fail, ✅ 25 pass | ❌ 28/28 fail | Yes |
| dsh-review | 12 | 12 exact `0.1.5-rc.2` | ❌ 12/12 fail | ❌ 12/12 fail | Yes |
| dsh-session-persistence-jsonl-cache | 3 | 3 exact `0.1.5-rc.2` | ❌ 3/3 fail | ❌ 3/3 fail | Yes |
| dsh-client-ui-teratts | 6 | 6 caret `^0.1.0-rc.8` | ✅ ALL PASS | ❌ 6/6 fail | Yes |
| dsh-web-mobile v2.3.1 | 9 | 9 union ranges (incl. `>=0.1.2-a <0.2.0`) | ✅ ALL PASS | ❌ 9/9 fail | Yes |
| @openviking/dsh-memory-plugin | 3 | 3 union `>=0.1.0-rc.6 <0.2.0 \|\| ^0.1.5-rc.1` | ✅ ALL PASS | ❌ 3/3 fail | Yes |

**All 14 bundles in `dsh.profile.bundles` (including out-of-tree) are checked by the runtime `evaluatePluginCompatibility` gate.** Bundles with only caret or open ranges pass the runtime gate (`includePrerelease: true`) and will not be skipped at boot. Bundles with exact-pinned peers fail the runtime gate and will be **skipped** unless granted a version exemption via `dsh plugin allow-version`.

**pnpm install behavior**: The profile's `pnpm-workspace.yaml` sets `autoInstallPeers: false`. `strict-peer-dependencies` is not explicitly configured; exact install-time behavior (warnings vs hard fail) should not be assumed without testing. Standard npm semver (without `includePrerelease`) applies at install time, so all `@deepseek-ai/dsh-*` peer declarations across the bundles that declare them would produce pnpm diagnostics. Bundles with zero DSH peers produce no pnpm DSH-peer diagnostics.

**Required action:** Bundles with exact-pinned peers (dsh-workspace-groups: 14, dsh-review: 12, dsh-session-persistence-jsonl-cache: 3, dsh-codex-auth: 3 of 28) must be rebuilt with widened ranges or granted version exemptions to avoid being skipped at boot. Bundles using only caret or open ranges (teratts, mobile v2.3.1, OpenViking memory, dsh-web-app, fleet-cleaner) pass the runtime gate and will load without exemptions. Bundles with no DSH peers (cpamc-limits, ai-egress, openviking-status, review-policy, dsh-base) are unaffected by the compatibility gate.

---

## 2. Plugin-Manager Compatibility Gate Semantics

**Status: VERIFIED IN 0.1.7-rc.2 SOURCE**

### 2a. Bundle-level gate (`plugin-compatibility.ts` + `profile.ts`)

Source: [`packages/boot/app-boot/src/plugin-compatibility.ts`](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.7-rc.2/packages/boot/app-boot/src/plugin-compatibility.ts), [`packages/boot/app-boot/src/profile.ts`](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.7-rc.2/packages/boot/app-boot/src/profile.ts)

**Scope**: `profile.ts` iterates every name in `dsh.profile.bundles` — all 14 bundles including out-of-tree packages — and calls `evaluatePluginCompatibility(...)` for each.

**Exact guard** (`evaluatePluginCompatibility`): For each `peerDependencies` entry whose name is `@deepseek-ai/dsh` or starts with `@deepseek-ai/dsh-`, the function calls:

```ts
semver.satisfies(runtimeVersion, requirement, { includePrerelease: true })
```

**`includePrerelease: true` is hardcoded.** This means caret ranges like `^0.1.5-rc.1` and open ranges like `>=0.1.0-rc.6 <0.2.0` **DO satisfy `0.1.7-rc.2`** at this gate. Only exact-pinned versions (e.g. `0.1.5-rc.2`) fail. `workspace:^`, `workspace:~`, and `workspace:*` ranges are resolved to the current runtime version and always pass.

**Skipped-bundle semantics** (`loadProfileDirectory` in `profile.ts`): This gate runs inside a `try/catch` block for each bundle. An incompatible bundle is **skipped** and listed in `profile.skippedBundles` with a diagnostic — it does **not** crash boot. The profile continues loading remaining bundles.

**Exemption mechanism**: A bundle that fails the peer check can be explicitly exempted via `dsh plugin allow-version` (exact name@version → exact runtime version grant). When `issue.exempted === true`, the bundle loads normally.

### 2b. pnpm install-time checks (separate layer)

The profile's `pnpm-workspace.yaml` sets `autoInstallPeers: false`. `strict-peer-dependencies` is not explicitly configured — exact install-time behavior (warnings vs hard fail) should not be assumed without testing. Standard npm semver (without `includePrerelease`) applies at pnpm install, so all `@deepseek-ai/dsh-*` peer ranges (in bundles that declare them) report as unsatisfied for `0.1.7-rc.2` (whether pnpm errors or only warns depends on `strict-peer-dependencies` configuration). Bundles with no DSH peers produce no pnpm DSH-peer diagnostics. This is a separate layer from the runtime boot gate.

**Note**: `packages/core/manager/src/operations.ts` returned HTTP 404 at the expected path; the plugin manager operations source was not inspected. The `dsh plugin allow-version` exemption mechanism is described in `pluginCompatibilityWarning()` output and accepted as authoritative.

---

## 3. Yellow Risks (not hard stops, but require canary verification)

### YR-1: OpenViking memory plugin `agent/session-start` — silent failure

**Status: CONFIRMED RISK — memory injection will silently stop working**

File: `/var/lib/dsh/.dsh/profiles/web-015/node_modules/@openviking/dsh-memory-plugin/index.mjs`, line 33:
```js
ctx.on("agent/session-start", ({ agent }) => { ... });
```

In 0.1.5-rc.2, `agent/session-start` is emitted by `dsh-agent-loop` (confirmed at `lib/index.js:1720`). The 0.1.7 spec says this event is **replaced by async `agent/created`**. If the event name changes, this listener silently never fires — no crash, no warning, just **no memory context injected into agent sessions**.

The `agent/created` event already exists in 0.1.5-rc.2 (confirmed in `dsh-agent/lib/types/index.js:326` and `dsh-agent-presets`), but it has different semantics (synchronous composition-only in 0.1.5 per docs at `runtime-types.d.ts:216`). The 0.1.7 change makes `agent/created` the startup-driving point.

Additionally, `runtime.mjs:410-413` uses `session.ownEvents()` with a graceful fallback:
```js
const ownEvents = typeof session?.ownEvents === "function"
    ? session.ownEvents()
    : (session?.events || []).slice(session?.header?.seedLength ?? 0);
```
The fallback protects against `ownEvents` removal but may produce different results if the API semantics change. In 0.1.7-rc.2, `ownEvents()` is present but `@deprecated` (see YR-2); the fallback path would not trigger. The `seedLength` field referenced in the fallback is rejected by 0.1.7's `validateSessionHeader` (`throw new Error('session header has invalid field "seedLength"')`), so a restored session could not carry it — the fallback's `?? 0` would apply, which may differ from `inheritedEventCount`.

**Required action:** A new version of `@openviking/dsh-memory-plugin` must register on `agent/created` instead. Canary must verify both memory startup injection and runtime recall actually function.

### YR-2: codex-auth `snapshotEvents()` / `ownEvents()` — deprecated but present in 0.1.7, no codex-auth rebuild

**Status: CONFIRMED DEPRECATED-WITH-IMPLEMENTATION — verified in official 0.1.7 source**

Usage confirmed at:
- `/var/lib/dsh/.dsh/profiles/web-015/node_modules/dsh-codex-auth/lib/image.js:490`: `agent.session.snapshotEvents()`
- `/var/lib/dsh/.dsh/profiles/web-015/node_modules/dsh-codex-auth/lib/compaction.js:63`: `agent.session.snapshotEvents()`

**Both `snapshotEvents()` and `ownEvents()` are present and fully implemented in 0.1.7-rc.2** with `@deprecated` annotation. The exact deprecation text on all three methods is:

> `@deprecated Existing logic may remain unmigrated for now, but new calls are prohibited.`
> `See the [Agent Note](../../../../.agents/notes/implemented/architecture/2026-09-09-deprecate-synchronous-session-event-reads.md).`

Verified at [`packages/core/session/src/index.ts`](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.7-rc.2/packages/core/session/src/index.ts):
- `snapshotEvents()` (lines 647–662): returns `Object.freeze(this.log.slice(fromSeq, toSeqExclusive))` — same frozen-snapshot behavior as 0.1.5.
- `ownEvents()` (lines 670–673): delegates to `this.snapshotEvents(this.inheritedEventCount)`.
- `eventAt()` (lines 639–641): returns `this.log[seq]`.

The 0.1.7 source itself uses `snapshotEvents()` in `SessionStore.fork()` (line 1265) with an inline suppression comment: `// oxlint-disable-next-line typescript/no-deprecated -- Existing fork snapshot read; migration deferred.`

The deprecation indicates a future removal path but does **not** break existing callers in 0.1.7.

The installed codex-auth `0.3.3-rc.1` was built against `0.1.5-rc.1` dev dependencies. No `0.1.7` reference exists in the codex-auth tree. npm `dsh-codex-auth@0.3.3-rc.1` exists on the registry (dist-tags: `latest`=0.3.2, `rc`=0.3.3-rc.1). The local install contains a proxy patch (`lib/native-checkpoint-C8Hr2FQh.js`, `lib/types/env-proxy.d.ts`, `manageEnvProxy` config) not present in the upstream npm tarball — the local `manageEnvProxy` patch must be retained. **A rebuild must use a new version number** (e.g. `0.3.3-rc.2`, which is confirmed not published on npm as of 2026-09-25; published versions: 0.1.0–0.3.2, 0.3.3-alpha.5–7, 0.3.3-rc.1). Reusing `0.3.3-rc.1` for a rebuilt tarball with different content would be a registry version collision — the upstream npm `0.3.3-rc.1` tarball has different content (no proxy patch).

Of the 28 DSH peer deps, 25 use caret ranges (`^0.1.5-rc.1`) which pass `semver.satisfies` with `includePrerelease: true`; 3 are exact-pinned (`dsh-compaction`, `dsh-compaction-basic`, `dsh-token-meter` at `0.1.5-rc.1`) and are marked `optional` in `peerDependenciesMeta`. Missing optional peers won't crash install, but their API compatibility with 0.1.7 compaction/token-meter packages is unknown.

**Risk is lower than originally stated:** `snapshotEvents()` and `ownEvents()` are present with full implementation in the 0.1.7 source (deprecated, not removed). Runtime behavior has not been independently tested — source inspection shows the implementation is retained, but canary verification is required to confirm runtime equivalence. The remaining risk is untested API surface beyond these methods and the missing 0.1.7 rebuild.

### YR-3: dsh-review `snapshotEvents()` / `ownEvents()` — same deprecation, same verified presence

**Status: CONFIRMED DEPRECATED-WITH-IMPLEMENTATION — same as YR-2**

Usage at `/var/lib/dsh/.dsh/profiles/web-015/node_modules/dsh-review/lib/host.js` and `src/host.ts`:
```js
agent.session.snapshotEvents().find(e => e.type === 'command/run' && ...)
```
Used in the `approve()` method to verify a human command receipt. **Both `snapshotEvents()` and `ownEvents()` are present and fully implemented in the 0.1.7 source** (see YR-2 verification; exact deprecation text: *"Existing logic may remain unmigrated for now, but new calls are prohibited."*). This usage should work under the deprecated API based on source inspection; runtime verification in canary is required. The risk is future removal in a post-0.1.7 release, not breakage at 0.1.7.

### YR-4: Session V4 format — one-way gate on rollback

**Status: CONFIRMED RISK — V4 format version verified in 0.1.7 source**

The 0.1.7-rc.2 source confirms `SESSION_FORMAT_VERSION = 4` ([`packages/core/session/src/types.ts`](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.7-rc.2/packages/core/session/src/types.ts)) and `validateSessionHeader` enforces `record.version !== SESSION_FORMAT_VERSION` as an exact match ([`packages/core/session/src/index.ts`](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.7-rc.2/packages/core/session/src/index.ts)). Current 0.1.5-rc.2 session source references format migrations (at `types.js:52`) but does not implement V4.

Once 0.1.7-rc.2 writes any session in V4 format, those sessions become **unreadable by 0.1.5-rc.2**. Rollback requires retaining the original pre-migration session data separately; it cannot be a simple binary swap.

**Read-open vs write-open distinction: UNKNOWN.** The 0.1.7 types.ts comment states: *"header-only readers classify supported historical formats, while an event-body read composes the build-static adjacent chain and publishes only this final generation before constructing a Session."* This suggests a migration-on-read pipeline exists, but whether opening a V3 session for reading silently upgrades the stored format to V4 **cannot be determined from the session source alone** — the persistence layer (`dsh-session-persistence-jsonl`) owns the storage writes and was not inspected in its 0.1.7 form. This remains **unverified** — if 0.1.7 immediately upgrades session format on read, even opening old sessions could corrupt the rollback path.

---

## 4. TTS Security Finding — Correcting Prior Opus Report

### CORRECTION: TTS `getChunk` cross-session access — per-session ACL missing within authenticated context

**Status: CONFIRMED PER-SESSION ACL GAP — not anonymous exposure, but cannot be called secure**

The prior report stated TTS security was adequate. That was wrong — there is a cross-session data access issue. However, `dsh-client-connection` **does** enforce authentication: signed-cookie browser auth with HMAC verification, Host/Origin trust fence, and launch-token exchange (source: [`dsh-client-connection/lib/index.js` lines 217–447](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.7-rc.2/packages/core/client-connection/src/index.ts), verified in installed 0.1.5-rc.2 at same path). The issue is **not** anonymous exposure but **missing per-session ownership checks** within an already-authenticated browser session — an authenticated user can synthesize TTS for messages in sessions they did not create. This cannot be called secure because per-session authorization is absent. Evidence:

**File:** `/var/lib/dsh/.dsh/profiles/web-015/node_modules/dsh-client-ui-teratts/lib/index.js`, lines 220–233:

```js
async getChunk(messageId, chunkIndex, signal) {
    const sessions = this.ctx.get("sessions")?.list?.() ?? [];
    const session = sessions.find((item) => item.deriveMessages?.().some(
        (message) => message.id === messageId && message.role === "assistant"
    ));
    const chunks = messageChunks(session, messageId);
    // ... synthesizes and returns audio
}
```

**Problems identified:**

1. **No session ownership check:** `getChunk` iterates ALL sessions via `this.ctx.get("sessions")?.list()`, then finds the first session containing the requested `messageId`. There is no check that the requesting client owns or has access to that session.

2. **Exposed as Remote method:** The `Remote("getChunk")` decorator (line 375-378) makes this callable from any connected web client through the Typert RPC protocol.

3. **No per-session ownership check:** `dsh-client-connection` authenticates the browser session (signed-cookie HMAC, Host/Origin fence), so unauthenticated access is blocked. However, the **host-side** `getChunk` does not validate that the caller's authenticated session scope matches the session containing the requested message — it accepts any `messageId` from any authenticated client and searches globally. The issue is conditional on having an authenticated browser and knowing (or guessing) a valid `messageId`.

4. **Information leakage (conditional):** An authenticated client probing `messageId` values can discover whether a message exists in any session and obtain its TTS audio, revealing the text content of messages in other sessions. This requires a valid browser auth cookie and knowledge of message IDs (which are UUIDs — not easily enumerable, but not secret within a shared deployment).

**This is a pre-existing issue in 0.1.5-rc.2, not introduced by the migration**, but the migration must not silently preserve it without explicit user acknowledgment. The spec (line 22) correctly flags this: "TTS Host code differs from source and its direct `getChunk` across all live sessions is a separate security decision."

### TTS cache preservation

**Status: VERIFIED — in-memory only, no persistence risk**

The `AudioCache` class (in `audio-cache.js`) is a pure in-memory LRU cache with TTL (default 4h, 128MB max). It has no disk persistence. During migration:
- Cache contents are lost on any plugin reload or Host restart (expected behavior)
- The cache implementation itself doesn't need migration
- The **plugin bundle tgz must be preserved**: `/var/lib/dsh/.dsh/bundles/dsh-client-ui-teratts-0.8.8-rc1.local.2.tgz` (25,761 bytes, read-only)

**The TTS plugin's peer deps (`^0.1.0-rc.8`) pass the runtime `evaluatePluginCompatibility` gate (`includePrerelease: true`) and will not be skipped at boot.** pnpm install-time semver (without `includePrerelease`) will report diagnostics for these ranges.

---

## 5. Canary Isolation Requirements

Based on the spec's Phase B/C requirements and the findings above, a canary environment must satisfy:

| Requirement | Rationale |
|---|---|
| Separate `DSH_HOME` directory | Prevent any write to production profile data |
| Separate profile directory (not `web-015`) | Avoid session format corruption (YR-4) |
| Separate HTTP port | No competing listener on production port |
| Separate browser auth session/cookie scope | No credential leakage between canary and production |
| No symlinks or hardlinks to production session data | V4 writes in canary must not touch production JSONL files |
| Session data: encrypted **copy** only, with user consent | Per spec line 18; never the live originals |
| Disposable credentials only | Per spec line 13; no live API keys/tokens |
| Pinned Node version and pnpm lockfile | Reproducible environment; if testing mobile v3.0.3, requires Node ≥24 |
| Synthetic test sessions for smoke testing | Real sessions used only for format conversion test with consent |
| Independent rollback verification | Test on a disposable clone that 0.1.5-rc.2 can still boot cleanly after canary data is discarded |

**Additional canary-specific checks required:**
1. All 7 out-of-tree plugins load via cordis without the JSONL cache crash (requires HS-1 fix first)
2. Memory plugin `agent/session-start` listener does fire (or is confirmed broken, proving YR-1)
3. `snapshotEvents()` / `ownEvents()` — verified `@deprecated` with full implementation in [0.1.7 source](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.7-rc.2/packages/core/session/src/index.ts); canary must confirm runtime behavior matches source (deprecation warning in logs, not removal; runtime not independently tested prior to canary)
4. TTS `getChunk` behavior with 0.1.7 session list API (sessions may use multi-instance in 0.1.7)
5. `spill-policy.maxInlineBytes` → `maxInlineTokens` setting migration verified
6. Verify `evaluatePluginCompatibility` gate behavior for all 14 bundles — confirm exact-pinned bundles are skipped (not crashed) and caret/open-range bundles load normally

---

## 6. Precise User Decisions Required

### Decision D-1: Semver strategy for bundles with exact-pinned peers
**Context:** The 0.1.7 runtime boot gate iterates all 14 bundles in `dsh.profile.bundles` and calls `evaluatePluginCompatibility(...)` with `includePrerelease: true`. Bundles with caret/open ranges (teratts, mobile v2.3.1, OpenViking memory) pass the gate. Bundles with **exact-pinned** peers are skipped at boot: dsh-workspace-groups (14), dsh-review (12), dsh-session-persistence-jsonl-cache (3), dsh-codex-auth (3 of 28).

**Options:**
- (a) Rebuild exact-pinned bundles with widened peer ranges targeting `>=0.1.5-rc.1 <0.2.0`
- (b) Grant version exemptions via `dsh plugin allow-version` for canary, rebuild for production

**Recommendation:** (a) for operator-owned packages (this repository); (b) as interim for canary testing of others.

### Decision D-2: Mobile plugin version for 0.1.7 migration
**Options:**
- (a) Keep `dsh-web-mobile@2.3.1-local` on Node 22, verify it loads under 0.1.7 APIs (preserves current swipe/zoom touch behavior)
- (b) Upgrade to `dsh-web-mobile@3.0.3` and upgrade Node to ≥24 simultaneously (changes touch behavior to upstream's divergent swipe/zoom model)

**Risk note:** Option (b) doubles the migration blast radius and changes user-facing touch interaction. The installed v2.3.1-local preserves original swipe/zoom behavior that upstream v3.0.3 intentionally diverges from. v2.3.1-local's peer ranges use union ranges with `>=0.1.2-a <0.2.0` that pass `includePrerelease: true`; its API compatibility with 0.1.7 is still unknown. Current local mobile compatibility with 0.1.7 is **untested** — this is a read-only question until canary boot.

### Decision D-3: TTS `getChunk` cross-session access
**Status: REQUIRES SEPARATE DESIGN — cannot call global `getChunk` safe**

The global `getChunk` scans all sessions and cannot be called secure — it lacks per-session ownership checks within the authenticated context. Preserving TTS caching behavior while adding session-scoped ACL requires a separate design effort; the two concerns (cache preservation and session authorization) are coupled in the current implementation and cannot be resolved with a simple flag or option.

**Read-only question:** Does the operator accept the pre-existing per-session ACL gap for this migration cycle, or does this require resolution before proceeding? Resolution requires a separate TTS security design document.

**Note:** This is a pre-existing per-session ACL gap (not introduced by migration). `dsh-client-connection` provides browser-session authentication; the gap is that `getChunk` does not check session ownership within the authenticated context.

### Decision D-4: OpenViking memory plugin update
**Options:**
- (a) Request an upstream `@openviking/dsh-memory-plugin` update that uses `agent/created` instead of `agent/session-start` — **preferred path**
- (b) Operator-owned patch to the existing installed package (`agent/session-start` → `agent/created` in `index.mjs:33`) — only after explicit operator approval; local maintenance burden
- (c) **NO-GO** — if neither upstream nor operator patch is available, memory injection is non-functional under 0.1.7 and migration cannot proceed with this bundle

**Note:** A local fork of the OpenViking package is explicitly excluded. Options (a) and (b) are the only supported paths.

### Decision D-5: JSONL cache plugin rebuild
**Required** (no alternative): The exact `===` version guard must be updated. Options for the new guard:
- (a) Widen to accept `0.1.7-rc.2` explicitly
- (b) Use semver range `>=0.1.5-rc.2 <0.2.0`
- (c) Remove the version guard entirely and rely on API-level compatibility testing

### Decision D-6: Rollback boundary
**Question:** If canary writes V4 session data to the copy, and the migration is aborted, is the user willing to discard all canary-written sessions, or must there be a V4→V3 downgrade path?

---

## 7. Summary Matrix

| # | Item | Severity | Status | Blocks |
|---|---|---|---|---|
| HS-1 | JSONL cache exact `===` guard | 🔴 Functional blocker | Confirmed: skipped before import (normal path) or throws after exemption; caching non-functional either way | Canary boot |
| HS-2 | Mobile v3.0.3 Node≥24 + swipe/zoom divergence | 🟡 Candidate-only | Avoidable (keep v2.3.1); upstream changes touch behavior | Mobile v3.0.3 upgrade only |
| HS-3 | Semver prerelease peer rules | 🟡 Mismatch confirmed (not all 14 — some have no DSH peers) | 0.1.7 runtime gate uses `includePrerelease: true` (caret/open ranges pass); bundles with no DSH peers pass trivially; pnpm install uses standard semver (DSH-peer ranges in affected bundles report unsatisfied — whether pnpm errors or only warns depends on `strict-peer-dependencies`, which is not explicitly configured) | Exact-pinned bundles skipped at boot; others pass gate |
| YR-1 | OpenViking `agent/session-start` | 🟡 Silent failure | Confirmed | Memory recall |
| YR-2 | codex-auth `snapshotEvents()`/`ownEvents()` | 🟢 Lower than stated | `@deprecated` but present with full implementation in 0.1.7 source (runtime untested); local version has proxy patch not in upstream npm; rebuild must use new version (not `0.3.3-rc.1` — registry collision); `0.3.3-rc.2` suggested but not reserved | No 0.1.7 rebuild |
| YR-3 | dsh-review `snapshotEvents()`/`ownEvents()` | 🟢 Lower than stated | Same as YR-2; source-verified present, runtime canary test required | No 0.1.7 rebuild |
| YR-4 | Session V4 one-way format gate | 🟡 Confirmed risk | Read-open vs write-open unknown | Rollback |
| SEC-1 | TTS `getChunk` cross-session | 🟠 Per-session ACL gap | Cannot call global `getChunk` safe; preserving TTS caching with session ACL requires separate design | Separate design required |
| INFO-1 | Runtime bundle gate (`evaluatePluginCompatibility`) | ℹ️ Verified in 0.1.7 | `semver.satisfies` with `includePrerelease: true`; skips incompatible bundles (does not crash); applies to all 14 in `dsh.profile.bundles` (including out-of-tree) | N/A |
| INFO-2 | TTS cache is in-memory only | ℹ️ Verified | No persistence risk | N/A |
| INFO-3 | `spill-policy` setting rename | ℹ️ From spec | Not verified locally | Settings migration |
| INFO-4 | Profile `autoInstallPeers: false` | ℹ️ Verified | Explicitly set in `pnpm-workspace.yaml`; `strict-peer-dependencies` not explicitly configured | N/A |

---

## 8. Commands Run and Sources Cited

All inspection was read-only. No packages installed, no builds run, no processes started.

```
# Versions and environment
node -e "console.log(process.version)"                              # → v22.23.2
pnpm --version                                                       # → 11.22.0
cat /var/lib/dsh/.dsh-releases/v015-rc2-t4x7mz4n/runtime/package.json  # → @deepseek-ai/dsh: 0.1.5-rc.2

# npm registry queries
npm view @deepseek-ai/dsh@0.1.7-rc.2 version                      # → 0.1.7-rc.2
npm view @deepseek-ai/dsh@0.1.7-rc.2 dist.integrity               # → sha512-SQFhriLvza8...
npm view @deepseek-ai/dsh-session@0.1.7-rc.2 dist.tarball          # → confirmed available
npm view dsh-web-mobile@3.0.3 engines                              # → { node: '>=24.0.0' }
npm view dsh-web-mobile@3.0.3 description                          # → "尽可能的使dsh适配竖屏等移动端设备"
npm view dsh-codex-auth@0.3.3-rc.1 version peerDependencies engines # → exists; dist-tags: latest=0.3.2 rc=0.3.3-rc.1; 28 DSH peers; engines: { node: '^22.19.0 || >=24.0.0' }

# Semver satisfaction tests (standard, no includePrerelease)
npx semver 0.1.7-rc.2 -r "^0.1.5-rc.1"                            # → exit 1 (FAIL)
npx semver 0.1.7-rc.2 -r "^0.1.0-rc.8"                            # → exit 1 (FAIL)
npx semver 0.1.7-rc.2 -r "0.1.5-rc.2"                             # → exit 1 (FAIL)

# Semver satisfaction tests (with includePrerelease — matches 0.1.7 runtime gate)
npx semver 0.1.7-rc.2 --include-prerelease -r "^0.1.5-rc.1"       # → exit 0 (PASS)
npx semver 0.1.7-rc.2 --include-prerelease -r "^0.1.0-rc.8"       # → exit 0 (PASS)
npx semver 0.1.7-rc.2 --include-prerelease -r ">=0.1.0-rc.6 <0.2.0"  # → exit 0 (PASS)
npx semver 0.1.7-rc.2 --include-prerelease -r "0.1.5-rc.2"        # → exit 1 (FAIL — exact pins always fail)

# pnpm peer strictness
# Profile pnpm-workspace.yaml: autoInstallPeers: false (NOT the pnpm 11.x global default of true)
# No .npmrc found (runtime, profile, or user)
# strict-peer-dependencies not explicitly configured
# Exact install-time behavior (warnings vs hard fail) should not be assumed without testing

# Source inspection (read-only, installed 0.1.5-rc.2 runtime)
# cordis-plugin-loader v1.0.3: grep for semver/peer/satisfies → zero results
# JSONL cache: lib/index.js lines 7-11 exact version guard
# TTS: lib/index.js lines 220-233 getChunk cross-session scan
# dsh-client-connection: lib/index.js lines 217-447 signed-cookie browser auth,
#   Host/Origin fence, launch-token exchange — browser authentication confirmed
# OpenViking memory: index.mjs:33 agent/session-start, runtime.mjs:410-413 ownEvents
# codex-auth: lib/image.js:490, lib/compaction.js:63 snapshotEvents usage
#   local version has proxy patch (env-proxy.d.ts, native-checkpoint-C8Hr2FQh.js)
# dsh-review: lib/host.js snapshotEvents in approve()
# dsh-agent-loop: lib/index.js:1720 agent/session-start emission (0.1.5)
# dsh-agent: lib/types/index.js:326 agent/created emission (0.1.5, different semantics)

# Official 0.1.7-rc.2 source (HTTP 200, fetched from GitHub raw.githubusercontent.com)
# github.com/deepseek-ai/deepseek-harness tag dsh-v0.1.7-rc.2
# packages/boot/app-boot/src/plugin-compatibility.ts — evaluatePluginCompatibility:
#   semver.satisfies(runtimeVersion, requirement, { includePrerelease: true })
#   checks only @deepseek-ai/dsh or @deepseek-ai/dsh-* peerDependencies
# packages/boot/app-boot/src/profile.ts — loadProfileDirectory:
#   iterates every name in dsh.profile.bundles (all 14 including out-of-tree)
#   evaluatePluginCompatibility called per bundle in try/catch; incompatible → skipped
# packages/core/session/src/index.ts — snapshotEvents @deprecated lines 647-662
#   ownEvents @deprecated lines 670-673 (delegates to snapshotEvents)
#   eventAt @deprecated lines 639-641
#   SessionStore.fork() line 1265: uses snapshotEvents with oxlint-disable-next-line
# packages/core/session/src/types.ts — SESSION_FORMAT_VERSION = 4
# packages/core/manager/src/operations.ts — HTTP 404 (path not found at tag)
```

**Files referenced but not modified:**
- `spec-dsh-upgrade-017-v2.md` — upgrade specification
- `dsh-017-readonly-compatibility.json` — static compatibility audit captured 2026-09-25T17:14Z

**Not available for inspection:**
- 0.1.7-rc.2 cordis-plugin-loader source (installed v1.0.3 is from 0.1.5 runtime; 0.1.7 loader may differ)
- 0.1.7-rc.2 persistence layer (`dsh-session-persistence-jsonl`) — read-open vs write-open behavior unknown
- `packages/core/manager/src/operations.ts` — returned HTTP 404 at tag `dsh-v0.1.7-rc.2`; the plugin manager operations source path may have moved
- Any worker reports from prior review phases

**Official 0.1.7-rc.2 source verified at:**
- [`github.com/deepseek-ai/deepseek-harness` tag `dsh-v0.1.7-rc.2`](https://github.com/deepseek-ai/deepseek-harness/tree/dsh-v0.1.7-rc.2)
- [`packages/boot/app-boot/src/plugin-compatibility.ts`](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.7-rc.2/packages/boot/app-boot/src/plugin-compatibility.ts) — `evaluatePluginCompatibility` with `{ includePrerelease: true }`
- [`packages/boot/app-boot/src/profile.ts`](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.7-rc.2/packages/boot/app-boot/src/profile.ts) — `loadProfileDirectory` skipped-bundle semantics
- [`packages/core/session/src/index.ts`](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.7-rc.2/packages/core/session/src/index.ts) — `snapshotEvents()` / `ownEvents()` / `eventAt()` all `@deprecated` with full implementation
- [`packages/core/session/src/types.ts`](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.7-rc.2/packages/core/session/src/types.ts) — `SESSION_FORMAT_VERSION = 4`
