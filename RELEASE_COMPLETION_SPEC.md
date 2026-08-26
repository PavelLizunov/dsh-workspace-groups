# Spec: Release Completion and DSH Upgrade Compatibility

## 1. Intent & Invariants
- Close confirmed functional, accessibility, concurrency, build/release, scale, and compatibility debt in bounded waves.
- Follow `CORE_ARCHITECTURE_RULES.md`: DSH owns Workspace/Session/filesystem; no speculative managers, repositories, DI, event buses, or duplicate entities.
- Every visible control works or is hidden; DnD/menu/keyboard share mutation paths.
- Manual overlay writes become revision-protected; conflicts never overwrite another client silently.
- DSH packages remain peer/platform contracts, never bundled private copies.
- Initial supported-version matrix is minimum `0.1.0-rc.8` and latest published `0.1.1-rc.2`; support claims require source, consumer, activation, mount, and live evidence.
- Active `web` profile is not changed or restarted without a separate user instruction.

## 2. Interface / Data Contract
```ts
interface ManualEnvelope {
  revision: number
  manual: ManualGroups
}

interface ManualWriteRequest {
  expectedRevision: number
  manual: ManualGroups
}

type SupportedDshVersion = '0.1.0-rc.8' | '0.1.1-rc.2'
```

## 3. Verification Checklist
- [x] Real Search actions; pending dialog guards; busy and Fork/Archive errors.
- [ ] Orphan overlay cleanup and stale-config recovery.
- [ ] Revision/ETag conflicts with multi-client tests.
- [ ] Group/Workspace keyboard-touch controls, Open Folder, Copy Path, source indicator.
- [ ] Directory path edit, hidden toggle, truncation and IME/focus tests.
- [ ] Session reorder and safe Copy ID/Title.
- [ ] Valid ARIA tree, roving focus, Arrow/Home/End and live announcements.
- [ ] Minimal View Options and Session overflow without speculative entities.
- [ ] Fail-closed portable verifier and rendered component tests.
- [ ] Deterministic build, clean declarations, complete tarball and consumer fixture.
- [ ] rc.8/rc.2 disposable compatibility matrix and 100/500/1000 Workspace measurements.
- [ ] Every wave: Gemini swarm, lead integration, Sol review, verification, Conventional Commit and push.
- [ ] Close `DEVELOPMENT_PLAN.md`, `AUDIT.md`, and baseline debt ledger with evidence.
