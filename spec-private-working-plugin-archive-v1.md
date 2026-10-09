# Spec: приватный recovery-бандл работающих DSH-плагинов

## 1. Intent & Invariants
- Оператор хочет выложить четыре уже используемых плагина в приватный GitHub и получать при восстановлении последний стабильный комплект. Эти рабочие байты можно отметить как **проверенный бинарный baseline**, но их `package.version` содержит `-local` или `-rc`, а у TTS/mobile нет source-backed provenance. Без сборки новых версий из чистых исходников не выдавать эти файлы за strict SemVer stable по ранее согласованной политике.
- Приватность обязательна. Не пушить исходники приватного `ai-gateway` в публичный `dsh-workspace-groups`. Не включать `*.tgz` в исходный публичный Git-репозиторий. Публиковать только exact четыре нынешних архивных файла с полными SHA и non-reproducible provenance; три старых `cpamc .1/.2` не использовать.
- Существующий `web-015` работает и остаётся pinned на локальных immutable `file:*.tgz`; сам факт появления Release не меняет запущенный DSH, manifest или lockfile. Никакого `pnpm`, reboot или перезапуска из-за публикации.

## 2. Interface / Data Contract
```text
Private repo: operator-approved new dedicated recovery repository, not public.
Release: one bundle tag, e.g. dsh-working-set/2026-09-25.1, prerelease=false,
  explicitly latest after independent upload+SHA+download check.
Assets: four byte-identical existing .tgz with exact internal versions,
        SHA256SUMS and recovery-manifest.json with origin "installed/packed
        local baseline", profile/DSH compatibility, hashes, pack inventory.
Consumer: use latest to DISCOVER versioned assets; verify release/asset digest,
          download no-clobber to local cache; stage pinned package.json/lockfile;
          never install directly from moving latest URL into production.
```
- Enable immutable releases on this **new private repo** before first publish if supported, use draft → upload → download/check → publish `make_latest=false` → verify immutable asset → set latest. If private account cannot produce immutable release and verify it, stop publication or explicitly separate archival backup from trusted stable channel. Read-only scoped GitHub credential for recovery; live classic `gh` credentials are not stored in assets/manifests.
- Single repo `latest` represents **the four-package bundle as a unit**, not per-package latest. Per-plugin stable channels require later separate repos, clean source/tag/build provenance, and signed release/CI gates. No tag/asset rename to remove `local`; latest release designation ≠ strict npm stable. Rollback retains previous bundle tag and sha.

## 3. Verification Checklist (Definition of Done)
- [ ] Confirm operator-approved exact repo name/visibility and whether four binaries may be published as stable *bundle* despite prerelease package versions; record that strict per-plugin stable policy remains unsatisfied.
- [ ] Scan archive inventory for secrets/path traversal and verify each SHA/installed version; review license/attribution and private-only data. Heuristic scan alone is not full secret audit.
- [ ] Create private repo only after approval; enable immutability; upload same byte-identical assets; verify downloaded contents and release latest; private API download smoke-test.
- [ ] Restore test from Release to isolated staging verifies all four exact bytes; production manifest/lockfile and Web process unchanged. If any check fails, fail closed without claiming stable publication.
