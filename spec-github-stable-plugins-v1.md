# Spec: GitHub stable/latest для рабочих DSH-плагинов (v1 — на критическое ревью)

## 1. Intent & Invariants
- Что: сохранить последние работающие исходники собственных/сторонних плагинов в Git, публиковать сколько угодно GitHub pre-release для испытаний, а после проверки выпускать обычный stable Release. GitHub `/releases/latest` — подвижный указатель только на stable; production DSH ставит только stable.
- `latest` разрешается при явном обновлении/восстановлении; зафиксированный `package.json` + `pnpm-lock.yaml` production не меняется сам от нового релиза. Архивы immutable, новая версия = новый архив и tag; исключены переиздание asset/tag и автоматическая установка floating Git URL.
- Релизные исходники, собранный пакет и устанавливаемый архив должны иметь проверяемую цепочку commit → tag → внутренний `package.json.version` → asset SHA-256 → canary → lockfile; исходники не содержат секретов, локальных данных или чужих изменений.
- Не публиковать ничего, не создавать GitHub-репозитории и не менять DSH без отдельных решений пользователя о списке/публичности/выпуске. Сервису DSH понадобится отдельное разрешение на рестарт.

## 2. Interface / Data Contract
```text
GitHub: stable release (prerelease=false, draft=false), immutable tag vX.Y.Z,
        downloadable plugin-name-X.Y.Z.tgz + SHA256SUMS + provenance.json
Canary: resolve GitHub /releases/latest → validate stable, tag, source SHA, asset
        digest → unpack and test → pin versioned immutable local cache file:*.tgz
Production: dsh.profile.bundles preserves order; manifest+lockfile pin exact
            stable artifact, no prerelease or floating URL; frozen install and
            separate approved restart; previous stable retained for rollback.
```
- Scope discovery: enumerate all active *operator-controlled* non-core plugins, distinguish `@deepseek-ai` in-box bundles (not ours to release), registry deps and third-party upstreams; map package source repository, GitHub visibility/license, current runtime drift, build/pack test, release owner and stable baseline. Resolve ambiguous “all working” with the user before new repos, visibility changes or publishing.
- Current facts: 14 active profile bundles; `dsh-workspace-groups` public repo, `ai-gateway` private monorepo, `dsh-fleet-cleaner` public repo with uncommitted changes; TTS and mobile have no verified `PavelLizunov` repo/source recovery yet. Existing `local` tgz are live, not stable GitHub Releases. A prerelease in a multi-package repo needs namespace-safe tags/assets; don't publish the entire private gateway as public merely for one plugin.
- Stable updater/restore step reads authenticated API for private repos, validates expected owner/repo and `prerelease=false`, stores archives under `~/.dsh/bundles/` with no-clobber names and hashes, stages whole profile and lockfile, checks resolved installed host/client bytes, then requests operator approval for production. Never embed tokens in manifest, artifact URL or public logs.

## 3. Verification Checklist (Definition of Done)
- [ ] Verified inventory of all in-scope active packages and explicit public/private decision for each; no bundled core or unrelated package silently released.
- [ ] Current fixes in TTS, mobile, workspace-groups, limits and Fleet Cleaner have reproducible source history, isolated tests and clean archive smoke-test; private code and credentials do not leak in release assets.
- [ ] Stable and multiple prereleases coexist; `/releases/latest` resolves only reviewed stable; tag, Git tree, version, asset and hash are bound, no mutable asset replacement.
- [ ] Negative checks: absent stable, inaccessible private repo, unexpected tag/asset/hash, rollback/older version, changed lockfile, and unavailable GitHub fail closed without touching production.
- [ ] Restore on a clean canary installs exactly same stable package bytes using pinned pnpm and `--frozen-lockfile`; DSH host/client graph and independent rollback can be checked before any real restart.

Questions for Pro: Is GitHub `/releases/latest` robust enough with manually set latest/commit-date ordering, or should latest be verified against release tags? Is a single repo for all private plugins better than new per-plugin repos? What precise trust chain/signed provenance is warranted? How should `dsh plugin install` reconciliation re-add retired bundles be guarded without core changes? Explicitly reject the plan if release safety or source provenance remains unproven; give concrete revisions, then an unambiguous verdict OK/NOT OK.
