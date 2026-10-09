# web-015: подготовка immutable-плагинов (без выкладки)

## Текущее состояние
- Профиль `web-015` и `dsh-web.service` не менялись: снимки исходных manifest/lockfile и sha256 live-файлов лежат в `.staging/plugin-deploy-v3/records/`.
- Одобренный план — `spec-plugin-deploy-v3.md`. Изменение production и рестарт требуют отдельных решений.
- Полный источник истины при выкладке — `/var/lib/dsh/.dsh/bundles/*.tgz` + проверенный staging manifest/lockfile, **не живые `node_modules`**.

## Кандидаты
| Пакет | Новая версия | SHA-256 архива |
| --- | --- | --- |
| `dsh-workspace-groups` | `0.1.1-local.20260924.1` | `a29faa83e8cba83a38896cdd4c4ad87b9605ad3df76f61c8e68d006bb135f126` |
| `dsh-cpamc-limits` | `0.1.1-local.20260924.2` | `c41b93ab547507362abdb879711baba1ad94efde992fedbce786627e79b720eb` |
| `dsh-client-ui-teratts` | `0.8.8-rc1.local.2` | `9a4fb49bbb77623555a2a00315512376256037dba9e7c0ac62f43fde02b73af9` |
| `dsh-web-mobile` | `2.3.1-local.20260924.1` | `579d9cf7586d75825743de8126a6ac977e75fcce65783654c1edb72b85a1970a` |

Файл `.staging/plugin-deploy-v3/records/SHA256SUMS` проверяет все четыре; каждый опубликован новым именем с режимом `0444`. `dsh-cpamc-limits@0.1.1-local.20260924.1` **не использовать**: smoke-test нашёл внешнюю ссылку на KeyGuard вне пакета. Исправленный `.2` включает `keyguard-lib/` и успешно импортируется из распакованного canary. Старый `.1` сохранён как доказательство неудачной попытки и не должен появляться в manifest.

## Проверки
- `dsh-workspace-groups` в изоляции: build, typecheck, 283 passed / 9 skipped, реальный loader и consumer pack/install passed.
- xAI-коллектор `dsh-cpamc-limits`: 12/12 тестов. Все четыре Host entrypoint импортируются из canary после воспроизведения 235 штатных DSH runtime fallback links; Client `node --check` прошёл.
- TTS: живые `lib/client.js` и `lib/index.js` побайтно сохранены; diff от исходного архива с SHA в `records/`. Mobile: пять исправленных файлов сравнены с исходным архивом, diff сохранён. Mobile prepack непригоден в распакованном пакете (не хватает tsconfig и scripts); опубликован prebuilt snapshot через `npm pack --ignore-scripts`.
- Все 4 новых архива: имя/внутренняя версия/metadata и **каждый runtime-файл** совпадают с установленными байтами в canary; SHA-256 verified. Для groups Host build отличается от live только комментарием с путём bundled `js-yaml`; Client идентичен.
- Canary на том же уровне каталогов, что и live: `/var/lib/dsh/.dsh-releases/v015-rc2-t4x7mz4n/profile-canary-plugin-deploy-v3`; `pnpm 11.22.0`, `nodeLinker: hoisted`. Текущие canary SHA-256: manifest `92fe701eafa0ac3741c983dcfdc2a3f9919f01ea7b98526a086bd370657b0305`, lockfile `32ecb84c169522158c4223b4f6160f61e1d8e008f3622e09e42190721cb72935`.
- Canary lockfile отличается только для D и транзитивных `@deepseek-ai/dsh-time-context`, `@deepseek-ai/dsh-util-values`; остальные direct dependency specs прежние. Исключение: старый live lockfile **уже не содержал** `dsh-web-mobile`, хотя live package.json его объявляет: исправляется в canary.
- Frozen install установил все четыре; повторные вызовы сохранили hashes и lockfile. `pnpm --reporter ndjson` установил причину `Packages: -25`: каждый раз удаляются 24 платформенно-несовместимых варианта `@img/sharp-*` и `@emnapi/runtime`; целевые архивы и 235 ссылок на DSH runtime не меняются. На live всё равно потребуется сверить полный hoisted-layout и активацию остальных плагинов.

## Ограничения и план будущего шага
- Не проверены authenticated browser UI, Host активация в полном DSH, TTS голос в браузере и xAI auth-file endpoint; сервер не перезапускали. Наличие xAI-карточки всё ещё зависит от фактического ответа шлюза и может требовать отдельного ремонта секретов.
- Исходный live профиль хранит 235 fallback-ссылок на DSH runtime. Чистый pnpm install в canary их не создал; для smoke-test они воспроизведены **только в canary** и сохранились после повторного frozen install. Код `dsh-app-boot/lib/index.js` (строки 645–667) восстанавливает общие и профильные fallback-ссылки при запуске профиля; `dsh plugin` (plugin-Ddi42qoW.js, строки 46–77, 101–127) сам только вызывает pnpm и сверяет `dsh.profile.bundles`. Перед live проверить порядок бандлов и Host конфигурацию; не обещать, что ссылки останутся нетронутыми до следующего запуска DSH.
- Нельзя откатывать на архивы от 14 сентября: в них отсутствуют текущие исправления. Снимок исходной пары manifest/lockfile и **полные копии** текущих четырёх установленных каталогов с текстом исходных симлинков сохранены в `.staging/plugin-deploy-v3/records/rollback-live-before-install/`. Дополнительно весь нынешний `node_modules` скопирован в `/var/lib/dsh/.dsh/backups/web-015-pre-plugin-deploy-v3-node_modules-20260924` и сверен: 20 669 файлов и 491 симлинк. Перед фактической выкладкой перечитать снимки и сделать свежие, если live изменился. Откат требует отдельного решения и может прервать чаты.
- `dsh plugin --profile web-015 install --frozen-lockfile` и один restart — только после отдельного явного разрешения. Рестарт прервёт все чаты и фоновые задания; не запускать ни его, ни live pnpm в рамках текущей подготовки.
