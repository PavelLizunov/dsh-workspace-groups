# Spec: Облегчение действующих DSH-плагинов без форков и переписывания (v1, ревью Pro)

## 1. Intent & Invariants
- Цель: улучшить измеряемую скорость/отклик действующего `web-015` на DSH `0.1.5-rc.2` минимальными штатными настройками и, только при доказанном bottleneck, маленькими изменениями в существующем собственном плагине. Никаких форков, переписывания, новых зависимостей, замены DSH core или публикации/рестарта по этой спеке.
- Сохранить color/grouping, Limits/xAI/API Keys, TTS, Fleet Cleaner, mobile, OpenViking, аутентификацию, фоновые функции; отключение функционального плагина ради цифры не считается оптимизацией. Не менять чужие/third-party бинарные сборки; если bottleneck в core, предложить upstream issue/feature request и обоснованные workaround-настройки, а не локальный патч.
- Source snapshot и graph rev фиксировать перед/после; работающий сервер и активные чаты не прерывать. Измерение > гипотеза > изолированный canary > только отдельное пользовательское разрешение для production-изменения/рестарта.

## 2. Interface / Data Contract
```text
Measured baseline: performance-baseline-web-015.json (60 client entries,
  12,173,521 raw JS bytes; seven non-core clients total 1,015,005 bytes).
Core document-preview: 6,888,478 raw bytes (56.6% total), ~3,190,677 gzip
  over loopback; hot gzip response ~95 ms median of 3 samples.
DSH Node host PID 264762: RSS ~926 MiB, 0.9% lifetime CPU at snapshot;
  systemd unit ~1.71 GiB includes other child processes, NOT plugin attribution.
Host/window/browser metrics are different quantities; don't add them.
```
- Read-only baseline next: normal authenticated browser trace (with user-supplied/approved browser session only), cold/warm reload and sidebar tab scenarios with actual transfer/parse/long-task/input latency; measure 5+ balanced repeats, report median/range and relevant confidence/noise. Host event-loop delay, process RSS/CPU sampled without attaching a disruptive inspector; count authenticated plugin API calls by endpoint via safe request-log/DevTools data, not unauthenticated GET 401 as proof of UI cost. Never benchmark on active production by flooding endpoints, disabling plugins or restarting.
- Hypotheses **not findings**: `dsh-workspace-groups` reload config every 15 s while page visible; `@dipertq/dsh-openviking-status` polls health/session/tasks 2.5 s active or 15 s idle; `dsh-cpamc-limits` polls Limits and Keys 60 s while each tab is mounted. Fleet Cleaner already stops its 15 s stats polling when tab invisible. Mobile debug badge's full-body observer/1.5 s timer only activates with `?mobile-nav-debug=1` and must not be treated as normal runtime load. Test whether native sidebar holds nonfocused tabs mounted before any poll-change proposal.
- Potential candidates ONLY if browser trace/endpoint counts prove benefit: use existing plugin options to reduce irrelevant polling (if supported); scoped visibility/`document.visibilityState` guard in own source if no config; dedupe concurrent requests without changing data freshness or masking errors. Each candidate affects one owner, is tested offline against exact DSH version and actual installed package, and carries source commit, versioned immutable archive, rollback. No speculative cache or decrease of refresh required for user-visible health/quota.
- Largest core PDF document-preview module may dominate startup size, but transfer is gzip and core is out of edit scope. Test whether disabling its native entry (where supported by profile patch) preserves *all* required Files/Start/document preview flows; otherwise reject and file upstream lazy-load proposal, not a core rewrite. Bundle size and Host RSS alone never prove UI latency or optimization success.

## 3. Verification Checklist (Definition of Done)
- [ ] Capture representative authenticated browser interaction and Host baseline, isolate plugin-attributable cost, validate baseline stability and operating conditions; if none found, conclude no safe change.
- [ ] Profile normal and slow path; choose smallest existing setting/own-plugin fix, no fork or full rewrite; preserve functions and privacy. Canary A/B must compare balanced repeats and a cold/warm holdout; include CPU/RSS and request-rate regression limits, and proper cleanup when tabs hide/unmount.
- [ ] Tests prove color/quotas/TTS/Fleet/mobile/secret handling and error states remain correct; a measured improvement must exceed noise and not move cost to Host or network. If unmeasured, report hypothesis only.
- [ ] ChatGPT Pro approves this read-only measurement/optimization *plan* explicitly; modifications, releases and disruptive production operations require separate human approval. No changes made by review itself.
