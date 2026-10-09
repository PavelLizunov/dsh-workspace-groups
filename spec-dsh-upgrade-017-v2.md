# Spec: подготовка миграции DSH 0.1.5-rc.2 → 0.1.7-rc.2

## 1. Intent & Invariants
- 2026-09-28 21:02 MSK: пользователь требует немедленный запуск обновления без нового аудита; актуальная цель `0.2.0-rc.1` (npm next), проблемы плагинов устранять после перехода. Выполнить отдельную установку ядра и копию текущего профиля, оставить старый runtime/profile; одна разрешённая перезагрузка Web с предупреждением. Не заявлять совместимость плагинов или RPO=0; не применять удаление данных, расширенные изменения ACL либо выпуск в GitHub с секретами. Минимальная проверка: версия установленного ядра, фактический путь запуска и результат рестарта.
- Цель пользователя — перейти сразу на exact `0.1.7-rc.2`, сохранив все используемые возможности `web-015` и данные. Пакет `@deepseek-ai/dsh@0.1.7-rc.2` доступен в npm по dist-tag `next` (не `latest`), GitHub tag `dsh-v0.1.7-rc.2` — immutable prerelease, полный SHA commit `477b4f420553e8a52c2fbccc464d7561b239c443`. Текущий Host `0.1.5-rc.2`, не менять его сейчас.
- Нельзя использовать старый профиль как «просто pnpm update»: core plugin graph, Client Sessions/slots, `Remote`, настройки, session log V4, JSONL и profile lifecycle изменились. Профиль должен сохранять 14 утверждённых bundle layers в порядке; семь retired dependencies не должны возрождаться при `dsh plugin install`; безопасность Web, работа TTS/xAI/Fleet/color/mobile и история сессий обязательны.
- Пользователь 2026-09-28 прямо потребовал немедленное обновление production. Данное сообщение является свежим одноразовым разрешением на один прерывающий чаты и задания рестарт; применять только после фактической проверки полного восстановимого снимка, актуального состава бандлов и целостного изолированного кандидата. Не изменять исходный release/profile; не считать статическую композицию доказательством функциональности. Каждый дополнительный рестарт потребует отдельного разрешения.
- Откат не обязан быть идеальным однокнопочным: сохранить точную текущую сборку и подготовить для оператора/агента проверенные инструкции восстановления. После новых durable writes на 0.1.7 исходные данные могут потеряться при возвращении к pre-upgrade snapshot; не утверждать RPO=0 и не запускать автоматический откат без нового решения.

## 2. Interface / Data Contract
```text
A: read-only inventory: SHA/profile + exact immutable four local tgz;
   compare each active plugin's peerDependencies and used APIs to 0.1.7.
B: approved now: prepare immutable 0.1.7 package closure and versioned plugin
   artifacts in new staging release directory, with pinned Node/pnpm/lockfile;
   no live files/credentials. Design but do not boot isolated DSH_HOME/profile.
   Candidate package checks and static imports are not proof of Host readiness.
C: canary boot, 14 bundle Host imports and client graph, endpoint/security/UI
   smoke, old-session format conversion tested on separate consented encrypted
   *copy*; if any plugin requires adaptation, new versioned archive per plugin.
D: separately authorized production cutover with complete verified snapshot,
   drained sessions, one authorized restart, monitored postchecks and rollback.
```
- **Read-only blockers already found:** `dsh-session-persistence-jsonl-cache` has a startup check requiring exactly session/JSONL `0.1.5-rc.2` (`lib/index.js:7–10`). `dsh-workspace-groups` pins 14 core peers to `0.1.5-rc.2`; `dsh-review` pins 12; codex-auth pins 3 exact old packages (and 28 core peers to the 0.1.5 release line) and uses `snapshotEvents()`; review also uses `snapshotEvents()`. The exact 0.1.7 session source still implements `snapshotEvents()` with a deprecation warning allowing existing callers, so these uses are semantic-test candidates, **not proven startup failures**. OpenViking memory runtime registers `agent/session-start` in `index.mjs:33` (replaced by async `agent/created`) and conditionally reads deprecated `ownEvents()` in `runtime.mjs:409–412`: memory startup/recall may silently fail even if Host boots. These are NOT automatically compatible with `0.1.7`. TTS Host code differs from source and its direct `getChunk` across all live sessions is a separate security decision; do not bake it into an unquestioned migration.
- `0.1.7` release notes warn that `agent/session-start` becomes async `agent/created`; synchronous Session history is deprecated; Client Sessions support multiple instances and slots change; plugin dependency resolution/unload changes; settings are owned by profile config, with old `settings.yaml` imported once; session log V4 and attachment semantics; Remote binary/stream and workspace file readBytes; `spill-policy.maxInlineBytes` becomes `maxInlineTokens`. Audit every active plugin/service plus all profile patches against the **exact installed candidate**, not just release notes. Explicitly test admin privileges, multi-session replay and auth boundaries.
- Восстановление должно учитывать фактический systemd/tmux launcher, старый runtime/profile manifest + lockfile, все bundle artifacts и абсолютные link-targets, settings и полный согласованный snapshot состояния (а не только выбранные сессии); не подключать две версии к одним mutable данным. Регулярный backup-stage сейчас не сохраняет дерево `.dsh-releases/v015...` и launcher `DSH-creator/.../production-v3`, поэтому нельзя считать его проверенным rollback. V4-written sessions могут быть не читаемы в 0.1.5; подготовить инструкции и изолированную проверку, а решение о потере post-cutover данных принимать до production переключения.

## 3. Verification Checklist (Definition of Done)
- [ ] Exact source+SRI for 0.1.7, candidate dependencies and all 14 plugins in compatibility matrix; reject unknown/failed plugin rather than silently disabling features.
- [ ] Proven isolation of canary DSH_HOME, profile, worker process, port, browser auth, scheduled jobs and session data. No live state writes or competing session ownership.
- [ ] Tests demonstrate plugin-specific compatible rebuilds, expected 14 active bundles, color/quotas/TTS with safe session access, mobile/Fleet/review, persistent session and settings conversion and unchanged Web authentication.
- [ ] Failure/rollback criteria defined before any production action; cutover requires separate operator permission and a separately approved one-use `dsh-web` restart.
