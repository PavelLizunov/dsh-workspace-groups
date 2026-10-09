# Spec: безопасная подготовка обновления DSH перед публикацией плагинов

## 1. Intent & Invariants
- Текущий Web — DSH `0.1.5-rc.2`, профиль `web-015`, 14 упорядоченных bundle layers; TTS, группы, Limits/xAI, Fleet Cleaner, mobile и остальные действующие возможности должны работать без потери данных, настроек, авторизации или истории чатов.
- `npm dist-tag latest` для `@deepseek-ai/dsh` указывает `0.1.5-rc.3`; GitHub последний pre-release — `dsh-v0.1.7-rc.2`, не npm latest. Первый кандидат для проверки совместимости — exact `0.1.5-rc.3`; `0.1.7-rc.2` — отдельная потенциальная миграция с изменениями Client Sessions, plugin runtime, settings, Remote, session log V4. Никаких floating `latest` во время воспроизводимого canary.
- Эта спецификация — только исследование и staged canary; не означает разрешения на установку нового DSH, создание другой VM, запуск второго DSH рядом с живым с тем же DSH_HOME, изменение prod `web-015` или перезапуск службы. Действующий Host не трогать до принятия результатов и отдельного решения оператора.

## 2. Interface / Data Contract
```text
Baseline: exact running DSH 0.1.5-rc.2 build + profile snapshot, SHA-256 all
  four known-good local plugin tgz and active dependency specs; complete state
  backup with tested rollback, encrypted session data remains outside Git.
Candidate: immutable exact @deepseek-ai/dsh@0.1.5-rc.3 npm tarball + its core
  package closure, pinned Node/pnpm, separate staging root/profile/ports.
Phase A: read-only compare core package APIs, Profile schema, Client loader,
  Remote/Settings/Session and Cordis slots; every active package classified
  compatible / requires adaptation / unknown with exact source evidence.
Phase B: if justified and separately approved, isolated canary with synthetic
  sessions + disposable auth, no production DSH_HOME/ports/credentials;
  frozen install and Host/client boot + actual browser UI smoke tests.
Phase C: explicit decision on migration, snapshot, one approved restart,
  postchecks, rollback on verified failure; not authorized here.
```
- Check installed plugin graphs/packages, required `dsh.client.inject` package IDs vs new core graph, `dsh.bundle.patch` & `cordis.patch.yml` rows, cross-release ownership of state files, `dsh plugin` reconciliation/retired deps, and unchanged security boundaries. A TTS source fix is not used to claim compatibility; its live artifact and source drift are separate, and direct `getChunk` across sessions remains a security blocker for publication until a proper design is chosen.
- Assess `0.1.7` only once exact `0.1.5-rc.3` result is known and after separate scope decision: 3,650 commits since `0.1.5-rc.2` per GitHub compare; migration of old APIs must be scoped, not silently port all plugins.

## 3. Verification Checklist (Definition of Done)
- [ ] Published npm/GitHub version/digest and actual installed build tied to full SHA; explicit `0.1.5-rc.3` vs `0.1.7-rc.2` decision; no floating dependency graph.
- [ ] Read-only compatibility matrix for each enabled plugin and core API, with blockers and exact test method; TTS/other dirty sources kept separate.
- [ ] An isolated profile/DSH_HOME canary is designed without collision with live sessions, ports, secrets or runtime caches; every use of production data would require separate consent.
- [ ] No production mutations or restarts from approval of this plan. Upgrade and rollback require explicit follow-up approval after canary evidence.
