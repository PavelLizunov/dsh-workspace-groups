# DSH 0.1.7-rc.2: статический аудит совместимости web-015

Только read-only исследование. Целевая версия согласована пользователем как `0.1.7-rc.2`, а не npm latest `0.1.5-rc.3`.
GitHub immutable prerelease tag: `dsh-v0.1.7-rc.2` → Git commit SHA: `477b4f420553e8a52c2fbccc464d7561b239c443`.
Репозиторий: `https://github.com/deepseek-ai/deepseek-harness` (официальный репозиторий `deepseek-ai/deepseek-harness`, а не `nicepkg/dsh`).
npm tarball ядра: `https://registry.npmjs.org/@deepseek-ai/dsh/-/dsh-0.1.7-rc.2.tgz`
npm integrity для `@deepseek-ai/dsh@0.1.7-rc.2`: `sha512-SQFhriLvza8GnFApnC5/32AgpcyKxrWnYXhvwDOLJdgWpkCX2EexyR9c8kCkMITJXnFLEN3Qb2CEh0W36vkLyw==`.
Манифест рабочего профиля `web-015`: `/var/lib/dsh/.dsh-releases/v015-rc2-t4x7mz4n/profile/package.json` → SHA-256: `0677208cd76cd4cd372d40417a7e367ef8310b2fe64f5311dbe454a2d92c62d5`.
Окружение выполнения: Node.js 22 (`v22.23.2`).
Файл сопоставления схемы: `dsh-017-readonly-compatibility.json` строго привязан к манифесту и сохраняет оригинальную структуру.

---

## Строгий вердикт: NO-GO перед любым Host Boot

**GO исключительно для статической Phase A (read-only аудит исходников и манифестов).**
**Абсолютный NO-GO для установки `0.1.7-rc.2` в production, запуска production Host (boot), миграции сессий, чтения реальных production настроек и production cutover.**

Запуск Host на 0.1.7 с доступом к production `DSH_HOME` приведёт к немедленным необратимым изменениям:
1. **Автоматический захват и мутация настроек (только при доступе к production `DSH_HOME`)**: ядро DSH 0.1.7 при старте автоматически обнаруживает `$DSH_HOME/settings.yaml`, переименовывает его в `settings.yaml.imported` и перезаписывает конфигурацию в формате нового профиля ещё до обработки первого запроса. При этом в изолированном synthetic-периметре с выделенным каталогом `$DSH_HOME` (например, `/tmp/dsh-017-synthetic`) production настройки изолированы и автоматически не мутируются.
2. **Точка невозврата Session Log V4**: штатная подсистема персистентности 0.1.7 при открытии сессии на запись публикует файл V4 рядом с V3. Попытка отката на 0.1.5 после появления записей V4 приведёт к рассинхронизации и потере данных.
3. **Функциональный отказ обязательной персистентности (jsonl-cache)**: ядро DSH 0.1.7 в `profile.ts` (`loadProfileDirectory`) проверяет peer-зависимости бандлов через `evaluatePluginCompatibility` ДО загрузки патча. Поскольку `dsh-session-persistence-jsonl-cache` имеет точные пины `0.1.5-rc.2`, штатный unexempted-путь загрузчика отсекает бандл в `skippedBundles` без краша Host. Guard времени импорта (`SUPPORTED_DSH_VERSION = '0.1.5-rc.2'`) выбрасывает исключение только ЕСЛИ бандл был принудительно допущен (bypassed/exempted через `dsh plugin allow-version`) или импортирован в кандидата с 0.1.7 peers. Оба пути приводят к отказу обязательной функциональности персистентности сессий (функциональный блокер), но доказательств фатального краша всего Host нет.

Любые динамические канареечные испытания допустимы исключительно в изолированном synthetic-периметре (с отдельным `$DSH_HOME`, гарантирующим сохранность production настроек) после устранения функциональных блокеров и с отдельного явного согласия пользователя.

---

## 1. Подтверждённые функциональные блокеры (Confirmed Functional Blockers)

В эту категорию входят только дефекты, доказанные анализом точного исходного кода установленных пакетов и ядра 0.1.7:

1. **`dsh-session-persistence-jsonl-cache` — функциональный блокер персистентности и условный throw guard**:
   - **Локация**: `lib/index.js:7-11`.
   - **Код**:
     ```javascript
     const SUPPORTED_DSH_VERSION = '0.1.5-rc.2';
     const DEFAULT_LIST_CACHE_TTL_MS = 30_000;
     if (sessionManifest.version !== SUPPORTED_DSH_VERSION || jsonlManifest.version !== SUPPORTED_DSH_VERSION) {
         throw new Error(`dsh-session-persistence-jsonl-cache requires DSH ${SUPPORTED_DSH_VERSION}; found session ${sessionManifest.version} and JSONL ${jsonlManifest.version}`);
     }
     ```
   - **Факты и архитектура загрузки DSH 0.1.7**: В среде DSH 0.1.7-rc.2 пакеты `@deepseek-ai/dsh-session` и `@deepseek-ai/dsh-session-persistence-jsonl` имеют версию `0.1.7-rc.2`. Точный код ядра 0.1.7 (`packages/boot/app-boot/src/profile.ts:674-681`, `loadProfileDirectory`) проверяет peer-зависимости бандла через `evaluatePluginCompatibility` **ДО** загрузки патча. Поскольку пакет содержит 3 exact-пина на `0.1.5-rc.2`, штатный unexempted-путь загрузчика отсекает бандл и помещает его в `profile.skippedBundles`, продолжая загрузку остальных бандлов профиля без краша Host. Внутренний guard времени импорта (`lib/index.js:7-11`) выбрасывает исключение (`throw new Error(...)`) только ЕСЛИ бандл был принудительно допущен (bypassed/exempted через `dsh plugin allow-version`) или импортирован напрямую в кандидата/контекст с 0.1.7 peers.
   - **Функциональный статус**: Оба сценария (пропуск бандла в `skippedBundles` либо условный throw при обходе проверки) приводят к отказу обязательной подсистемы персистентности сессий (`functional-blocked`). При этом доказательств того, что весь процесс Host фатально крашится при штатном запуске без exemptions, нет.
   - **Требование**: Необходим новый совместимый артефакт с валидацией контрактов V4 либо замена конфигурации на штатную персистентность. Правка строковой константы «вслепую» недопустима.

2. **`@openviking/dsh-memory-plugin` — удаление события `agent/session-start` в ядре**:
   - **Локация**: `index.mjs:33`.
   - **Код**: `ctx.on("agent/session-start", ({ agent }) => { ... })`.
   - **Факты**: В ядре DSH (начиная с 0.1.6 и в точном `0.1.7-rc.2`) событие `agent/session-start` удалено из жизненного цикла агента и заменено на awaited-событие `agent/created`.
   - **Последствия**: Подписка на `agent/session-start` никогда не сработает. Вызов `agent.inject()` не произойдет: долгосрочная память OpenViking, контекстные профили и каталог `<available-skills>` перестанут внедряться в сессии агентов. Это доказанная функциональная поломка контракта.

---

## 2. Неизвестные рантайм-исходы vs статические ограничения зависимостей

Аудит строго разграничивает доказанные блокеры кода, поведение пакетного менеджера и архитектуру загрузчика ядра:

1. **Exact Core Peers (`dsh-workspace-groups`, `dsh-review`, `dsh-codex-auth`)**:
   - `dsh-workspace-groups`: 14 exact core peers, жестко привязанных к `0.1.5-rc.2`.
   - `dsh-review`: 12 exact core peers, жестко привязанных к `0.1.5-rc.2`.
   - `dsh-codex-auth`: 3 exact core peers на `0.1.5-rc.1` и 25 peer ranges на `^0.1.5-rc.1` (всего 28 peer-зависимостей на ветку 0.1.5).

2. **Поведение npm semver 7.8.5 vs профиль pnpm**:
   - По умолчанию алгоритм `npm semver` (7.8.5) отклоняет prerelease-версию `0.1.7-rc.2` для старых диапазонов (например, `^0.1.5-rc.1` или `>=0.1.0 <0.2.0`), если кортеж диапазона не содержит совпадающего prerelease-тега без явной опции `{ includePrerelease: true }`.
   - **Рабочий профиль `web-015` (`pnpm-workspace.yaml`) сконфигурирован с параметрами**:
     ```yaml
     nodeLinker: hoisted
     autoInstallPeers: false
     ```
   - Наличие флага `autoInstallPeers: false` означает, что pnpm не пытается автоматически разрешать и доустанавливать пиры, однако это **логически не доказывает отсутствие фатального сбоя (hard-fail / install abort)** при установке или связывании зависимостей. Исход выполнения инсталлятора pnpm при конфликтах версий peer-зависимостей остаётся **неизвестным (unknown installer outcome)** без проведения изолированного тестового запуска в synthetic-периметре.

3. **Шлюзы совместимости в целевом коде 0.1.7 (Target Loader & Plugin Manager Gates)**:
   - Анализ точного исходного кода официального репозитория `deepseek-ai/deepseek-harness` по тегу `dsh-v0.1.7-rc.2` (commit `477b4f420553e8a52c2fbccc464d7561b239c443`, файлы `packages/boot/app-boot/src/profile.ts` и `packages/boot/app-boot/src/plugin-compatibility.ts`) подтверждает архитектуру шлюзов:
     - **Profile Bundle Loader Gate** (`packages/boot/app-boot/src/profile.ts:674-681`, `plugin-compatibility.ts`): при загрузке профиля **все 14 имён бандлов** из живого манифеста `package.json` (`dsh.profile.bundles`) проверяются как слои бандлов (bundle layers) вызовом `evaluatePluginCompatibility(bundleManifest, exemptions)`.
     - **Запрет ложного утверждения о plugin rows**: кастомные бандлы плагинов **НЕ являются отдельными строками плагинов (plugin rows) и НЕ избегают шлюза (escape gate)**. Все 14 компонентов профиля `web-015` явно перечислены в `dsh.profile.bundles` и проходят проверку шлюза бандлов при загрузке профиля (за исключением in-box бандлов ядра `@deepseek-ai/dsh-base` и `@deepseek-ai/dsh-web-app`, совместимость которых удовлетворяется штатным монолитным обновлением рантайма DSH).
     - **Семантика semver в `plugin-compatibility.ts`**: функция `evaluatePluginCompatibility` вызывает `semver.satisfies(runtimeVersion, requirement, { includePrerelease: true })` **исключительно для пиров `@deepseek-ai/dsh` и `@deepseek-ai/dsh-*`**. Благодаря флагу `includePrerelease: true` любые caret-диапазоны (`^0.1.5-rc.1`, `^0.1.0-rc.8`) и открытые диапазоны (`>=0.1.0 <0.2.0`, union-диапазоны) **успешно проходят runtime-шлюз**. Шлюз отсекает **только точные старые пины (exact old pins)**:
       - `dsh-workspace-groups` (14 exact `0.1.5-rc.2`) → FAIL (слой бандла пропускается в `skippedBundles`);
       - `dsh-review` (12 exact `0.1.5-rc.2`) → FAIL (слой бандла пропускается в `skippedBundles`);
       - `dsh-session-persistence-jsonl-cache` (3 exact `0.1.5-rc.2`) → FAIL (пропуск слоя в `skippedBundles` при unexempted загрузке; guard времени импорта выбрасывает throw только при bypass/exemption);
       - `dsh-codex-auth` (3 exact `0.1.5-rc.1` из 28 dsh-пиров) → FAIL (блокирует бандл без exemption, хотя остальные 25 caret-пиров удовлетворяют шлюзу).
     - **Разграничение с pnpm install**: обычный prerelease-mismatch по умолчанию в pnpm инсталляторе принципиально отличается от runtime bundle gate (pnpm оценивает диапазоны стандартным semver без `includePrerelease: true`). Реальный исход работы инсталлятора pnpm (предупреждение vs аборт) не доказан без синтетического запуска.
     - **Plugin Manager Preflight Gate** (`packages/boot/plugin-manager/src/operations.ts:342-351`): процедура `installPluginPackage` перед запуском `pnpm` также выполняет preflight-проверку манифеста через `evaluatePluginCompatibility`. При обнаружении несовместимых не-exempted пиров операция завершается отклонением (`rejected(preflight, 'nothing was installed')`).
   - **Разграничение**: Нельзя утверждать, что поведение загрузчика целевой версии неизвестно — шлюз пропуска слоёв доказан из исходного кода тега. Неизвестным без изолированного запуска остаётся только поведение самого инсталлятора pnpm.

---

## 3. Аудит безопасности TTS (`dsh-client-ui-teratts`)

1. **Прямое сканирование всех сессий в `getChunk`**:
   - **Локация**: `lib/index.js:220-222`.
   - **Код**:
     ```javascript
     async getChunk(messageId, chunkIndex, signal) {
       const sessions = this.ctx.get("sessions")?.list?.() ?? [];
       const session = sessions.find((item) => item.deriveMessages?.().some((message) => message.id === messageId && message.role === "assistant"));
       const chunks = messageChunks(session, messageId);
     ```

2. **Границы доступности и модель угроз (Reachability vs Authorization)**:
   - **Достижимость через Gateway**: Метод прямого вызова `getChunk` через RPC-мост Typert (`@Remote("getChunk")`) достижим **для аутентифицированных браузеров (accessible to authenticated browsers)**. Сетевой шлюз / reverse proxy DSH требует валидной сессии аутентификации пользователя (signed-cookie HMAC + Host/Origin fence); анонимный вызов из внешней сети отсекается на уровне шлюза.
   - **Отсутствие проверки прав на уровне сессий (No per-session ACL)**: Внутри контекста аутентифицированного браузера метод `getChunk` полностью лишён проверки прав доступа к конкретной сессии (lacks per-session ACL). Метод выполняет глобальный перебор абсолютно всех сессий инстанса (`this.ctx.get("sessions")?.list()`), сопоставляя только `messageId`.
   - **Уязвимость**: Аутентифицированный клиент, отправив запрос с идентификатором сообщения `messageId` чужой сессии (в том числе другого пользователя или фонового агента), получает аудиосинтез приватного ответа.

3. **Ограничения формулировок и архитектурные запреты**:
   - **ЗАПРЕЩЕНО называть реализацию безопасной (DO NOT call safe)**: Текущая семантика не обеспечивает защиту сессий; отсутствие per-session ACL позволяет аутентифицированному браузеру обращаться к чанкам любых сессий.
   - **ЗАПРЕЩЕНО заявлять об анонимной уязвимости (AVOID claiming anonymous exposure)**: Доступ защищён транспортной аутентификацией шлюза; анонимный трафик отсекается.
   - **ЗАПРЕЩЕНО трактовать транспортную аутентификацию шлюза или декоратор `@Remote` как сессионную авторизацию**: Наличие сессии браузера на шлюзе не заменяет проверку владения сессией на уровне сервиса.

---

## 4. Мобильный кандидат `dsh-web-mobile`: CONDITIONAL Canary

1. **Факты об upstream-релизе и установленном источнике**:
   - В npm опубликован пакет: `dsh-web-mobile@3.0.3`.
   - URL тарбола: `https://registry.npmjs.org/dsh-web-mobile/-/dsh-web-mobile-3.0.3.tgz`
   - Integrity: `sha512-zLPm0y1ZwstdeovpMLoVwHz5k0I9mN0SfNKWajvtsusUO2cXSrRZK5d0fSYNUYD/vg+svCTDv8Cq6b+8IuuGhA==`
   - Git Head в npm metadata: `881415ffe4daeab1723230e8940f87caeec09348` (верифицировано через `npm view dsh-web-mobile@3.0.3 gitHead`; фабрикация `null` недопустима).
   - Официальный git-репозиторий: `https://github.com/mexiaosqwq/dsh-web-mobile`.
   - Целевой официальный git-тег: `v3.0.3` (commit SHA `881415ffe4daeab1723230e8940f87caeec09348`).
   - Установленный источник в профиле `web-015`: локальный архив `file:/var/lib/dsh/.dsh/bundles/dsh-web-mobile-2.3.1-local.20260924.1.tgz`.
   - Поле engines: `node >=24.0.0` (наше рабочее окружение работает на Node 22: `v22.23.2`).
   - Флаг релиза: `immutable=false`.

2. **Осознанный отказ upstream от локальных хаков**:
   - **Факт**: Upstream `dsh-web-mobile@3.0.3` **намеренно НЕ сохраняет локальные хаки свайпа карточки композера и принудительного зума (upstream intentionally does NOT preserve local composer-card swipe and force zoom hacks)**.
   - Установленная в production локальная сборка `2.3.1-local.20260924.1` содержала специфичные локальные доработки:
     - **Composer-card swipe**: локальные патчи `sidebar-swipe.ts` и `gesture-guard.ts` (гибридное следование B-tier, зона захвата свайпа карточки композера, подавление ложных срабатываний через `consumedEl`, фиксация осей).
     - **Force zoom hacks**: хаки предотвращения авто-зума ввода в `phone-chrome.ts`, `misc.css.ts` и `layout.css.ts` (принудительное ограничение масштабирования и typography-guard).
   - Upstream 3.0.3 осознанно отказался от этих локальных модификаций в пользу стандартного мобильного макета.

3. **Статус: CONDITIONAL Canary и сохранение локальных модификаций**:
   - **Императив**: Локальные модификации текущей версии `2.3.1` **должны быть сохранены (current 2.3.1 local modifications must be preserved)**, если только оператор явно не согласится на изменение поведения.
   - Upstream 3.0.3 **НЕ ДОЛЖЕН перезаписывать production (`upstream current must not overwrite production`)**.
   - Тестирование 3.0.3 допустимо только как изолированная канарейка после проверки совместимости с Node 22 (при заявленном `node >=24.0.0`) и только в случае, если оператор готов принять отказ от локальных модификаций свайпа и зума.

---

## 5. Аудит `dsh-codex-auth`

1. **Факты официального реестра npm (верифицировано координатором через `npm view`)**:
   - В официальном реестре npm (`dsh-codex-auth`) dist-tags:
     - `latest: 0.3.2`
     - `rc: 0.3.3-rc.1`
     - `alpha: 0.3.3-alpha.7`
   - Пакет `dsh-codex-auth@0.3.3-rc.1` **существует в опубликованном реестре npm**:
     - URL: `https://registry.npmjs.org/dsh-codex-auth/-/dsh-codex-auth-0.3.3-rc.1.tgz`
     - Integrity: `sha512-oYiHUETYsm2HR7ZBfAW/nfP71HgIQZmmQJriHoAQE/xVw+PL9Tq8K17IhwmtGiZ1hafkb6bCJHR87M4yb2CixA==`.

2. **Локальный модифицированный архив той же версии (Installed Archive)**:
   - В профиле `web-015` установлена версия `0.3.3-rc.1` из локального артефакта: `file:/var/lib/dsh/DSH-creator/dsh-upgrade-0.1.5/artifacts/dsh-codex-auth-0.3.3-rc.1.tgz`.
   - Фактический integrity локального tarball: `sha512-EGgCVmZE+9CYu72lnAoUcvyGIxdwEEJrKxVubd7HQa65/KYqeCIzd/rch6pgQCEo+DQ/h47qw6IpeSXax9zUtA==`.
   - **Локальный патч `manageEnvProxy`**:
     Установленный архив той же версии `0.3.3-rc.1` содержит локальную модификацию для управления системным прокси:
     - Модуль `src/env-proxy.ts` / `lib/index.js:759-787`.
     - Опцию конфигурации `manageEnvProxy: z.boolean().default(true)` (`lib/index.js:1027, 1041-1044`):
       ```javascript
       if (config.manageEnvProxy !== false) installEnvHttpProxy((message) => {
           ctx.logger.warn(String(message));
       });
       ```
     - Типизацию в `lib/types/index.d.ts:27-28`:
       ```typescript
       /** Disable explicitly when the deployment owns the process-wide dispatcher. */
       manageEnvProxy?: boolean;
       ```
     - Соответствующую настройку в профиле `cordis.patch.yml`:
       ```yaml
       - id: llm-codex-auth
         config:
           llmEnabled: true
           manageEnvProxy: false
           codexCommand: /var/lib/dsh/.local/bin/codex
       ```
   - **Отличие от npm**: В upstream npm-пакете `dsh-codex-auth@0.3.3-rc.1` вызов `installEnvHttpProxy` выполняется безусловно, а свойство `manageEnvProxy` отсутствует.

3. **Обязательное разграничение и запрет замены на npm-версию**:
   - Необходимо строго различать **upstream npm rc** (`0.3.3-rc.1` из реестра npm) и **локально модифицированный rc** (`0.3.3-rc.1` с локальным патчем `manageEnvProxy` из архива артефактов).
   - **ЗАПРЕЩЕНО заменять установленный локальный архив на пакет из npm**: замена на npm-версию удалит патч `manageEnvProxy`, сломает конфигурацию `manageEnvProxy: false` в `cordis.patch.yml` и приведет к неконтролируемому перехвату диспетчера системного прокси хоста локальным плагином.

---

## 6. Статус `snapshotEvents()` и `ownEvents()` в exact 0.1.7

1. **Наличие в ядре `@deepseek-ai/dsh-session@0.1.7-rc.2`**:
   - `Session.prototype.snapshotEvents()` — физически присутствует в коде ядра. Помечен аннотацией `@deprecated — Existing logic may remain unmigrated for now`.
   - `Session.prototype.ownEvents()` — физически присутствует в коде ядра как обертка над `snapshotEvents(inheritedEventCount)`. Помечен `@deprecated`.
   - Внутренний код DSH 0.1.7 сам использует `snapshotEvents()` под локальными исключениями `deprecation exemptions`.

2. **Классификация риска (Жёлтый, не красный)**:
   - Использование `snapshotEvents()` в `dsh-review` (`lib/host.js`, `src/host.ts`), `dsh-codex-auth` (`lib/image.js`, `lib/compaction.js`) и `ownEvents()` в `@openviking/dsh-memory-plugin` (`runtime.mjs`) **не является причиной сбоя при старте (not a hard startup blocker)**.
   - Это технический долг, требующий регрессионного семантического тестирования перед релизом.

---

## 7. Сводная матрица кандидатов (Candidate Inventory & Audit Matrix)

Таблица охватывает все 14 бандлов профиля `web-015` в строгом порядке загрузки `bundle_order`:

| # | Bundle Name | Installed Spec / Version | Target / Candidate Version | Точный источник / URL pointer | Статический вердикт и классификация рисков | Phase A Verdict |
|---|---|---|---|---|---|---|
| 1 | `@deepseek-ai/dsh-base` | In-box core `0.1.5-rc.2` | Core `0.1.7-rc.2` | `https://registry.npmjs.org/@deepseek-ai/dsh/-/dsh-0.1.7-rc.2.tgz` | In-box core; обновляется монолитно с runtime DSH | In-box update |
| 2 | `@deepseek-ai/dsh-web-app` | In-box core `0.1.5-rc.2` | Core `0.1.7-rc.2` | `https://registry.npmjs.org/@deepseek-ai/dsh/-/dsh-0.1.7-rc.2.tgz` | In-box core; 2 peer ranges ветки 0.1.5 обновляются с ядром | In-box update |
| 3 | `dsh-workspace-groups` | `0.1.1-local.20260924.1` (file tgz) | Rebuild candidate `0.1.5+` | Local repository `/var/lib/dsh/Project/dsh-workspace-groups` | 14 exact peers `0.1.5-rc.2`. Profile loader 0.1.7 пропустит слой бандла (`skippedBundles`); исход инсталлятора pnpm неизвестен без изолированного запуска (`autoInstallPeers: false` не доказывает отсутствие hard-fail) | Requires Rebuild |
| 4 | `dsh-cpamc-limits` | `0.1.1-local.20260924.3` (file tgz) | Current local `0.1.1` | Local bundle `/var/lib/dsh/.dsh/bundles/dsh-cpamc-limits-0.1.1-local.20260924.3.tgz` | Нет жестких peers; требует проверки привязок Cordis | Requires Canary |
| 5 | `dsh-client-ui-teratts` | `0.8.8-rc1.local.2` (file tgz) | Local / Fixed | Local bundle `/var/lib/dsh/.dsh/bundles/dsh-client-ui-teratts-0.8.8-rc1.local.2.tgz` | **Security risk**: `getChunk` доступен аутентифицированным браузерам (gateway cookie HMAC), но не имеет per-session ACL (сканирует все сессии). Не заявлять об анонимной доступности и не называть реализацию безопасной. 6 peer ranges `^0.1.0-rc.8` удовлетворяют runtime bundle gate с `includePrerelease: true` | High Security Risk |
| 6 | `dsh-ai-egress` | `0.1.0` (link) | Current repo `0.1.0` | Local repo `/var/lib/dsh/Project/dsh-ai-egress` | Cordis service; требует валидации сетевого egress | Requires Canary |
| 7 | `dsh-codex-auth` | `0.3.3-rc.1` (file tgz) | `0.3.3-rc.1 (local patched)` vs npm `0.3.3-rc.1` | Локальный архив `/var/lib/dsh/DSH-creator/dsh-upgrade-0.1.5/artifacts/dsh-codex-auth-0.3.3-rc.1.tgz` vs npm registry `https://registry.npmjs.org/dsh-codex-auth/-/dsh-codex-auth-0.3.3-rc.1.tgz` | В npm существует `0.3.3-rc.1` (dist-tags latest=0.3.2, rc=0.3.3-rc.1; integrity sha512-oYiHUE...), но установленный tarball той же версии содержит локальный патч `manageEnvProxy`. Строго различать их и не заменять на npm; 3 exact peers на `0.1.5-rc.1` блокируют слой бандла в loader 0.1.7 (25 caret peers проходят с `includePrerelease: true`), `snapshotEvents()` deprecated; исход pnpm install не доказан | Local Modified RC / Do not replace with npm |
| 8 | `dsh-session-persistence-jsonl-cache` | `0.1.5-rc.2-homelab.1` (file tgz) | Incompatible | Artifact `/var/lib/dsh/DSH-creator/dsh-upgrade-0.1.5/artifacts/dsh-session-persistence-jsonl-cache-0.1.5-rc.2-homelab.1.tgz` | **CONFIRMED FUNCTIONAL BLOCKER**: 3 exact peers `0.1.5-rc.2`. Загрузчик профиля 0.1.7 (`profile.ts`) проверяет пиры ДО загрузки патча и отсекает бандл в `skippedBundles` (штатный unexempted путь). Throw времени импорта (`lib/index.js:7-11`) срабатывает только при обходе/exemptions (`dsh plugin allow-version`) или импорте в кандидата с 0.1.7 peers. Оба пути блокируют обязательную подсистему персистентности, но доказательств краша всего Host нет | **FUNCTIONAL BLOCKER** |
| 9 | `dsh-web-mobile` | `2.3.1-local.20260924.1` (file tgz) | npm `3.0.3` (gitHead `881415ffe4daeab1723230e8940f87caeec09348`) | `https://registry.npmjs.org/dsh-web-mobile/-/dsh-web-mobile-3.0.3.tgz` (official tag `v3.0.3`; installed source `file:/var/lib/dsh/.dsh/bundles/dsh-web-mobile-2.3.1-local.20260924.1.tgz`) | **CONDITIONAL canary**: npm-кандидат с engines `node >=24` (рабочее Node 22); локальные модификации 2.3.1 (свайп композера, зум-хаки) должны быть сохранены, если оператор не одобрит изменение поведения | **CONDITIONAL Canary** |
| 10 | `dsh-fleet-cleaner` | `0.2.0` (link) | Current repo `0.2.0` | Local repo `/var/lib/dsh/Project/dsh-fleet-cleaner` | Host webserver hook; peer `>=0.1.0 <0.2.0` удовлетворяет runtime bundle gate с `includePrerelease: true`; нормальный prerelease mismatch pnpm при установке; исход инсталлятора pnpm неизвестен без изолированного запуска | Requires Canary |
| 11 | `dsh-review` | `0.2.0` (link) | Current repo `0.2.0` | Local package `/var/lib/dsh/.dsh/packages/dsh-review/0.2.0` | 12 exact core peers `0.1.5-rc.2`; `snapshotEvents()` deprecated; loader 0.1.7 пропустит слой бандла без exemption | Requires Rebuild |
| 12 | `dsh-review-policy` | `0.1.0` (link) | Current repo `0.1.0` | Local package `/var/lib/dsh/.dsh/packages-src/dsh-review-policy` | Конфигурационный оверлей; зависит от работоспособности dsh-review | Secondary Risk |
| 13 | `@dipertq/dsh-openviking-status` | `0.3.2` (link) | Current repo `0.3.2` | Local package `/var/lib/dsh/.dsh/packages-src/dsh-openviking-status` | Чистый React UI плагин; минимальный риск | Low Risk |
| 14 | `@openviking/dsh-memory-plugin` | `0.5.1` (direct npm) | Incompatible `0.5.1` | npm package `@openviking/dsh-memory-plugin@0.5.1` | **CONFIRMED FUNCTIONAL BLOCKER**: 3 peer ranges удовлетворяют runtime bundle gate с `includePrerelease: true`, но событие `agent/session-start` удалено в ядре 0.1.7 (заменено на awaited `agent/created`), что отключает внедрение памяти/навыков; `ownEvents()` deprecated | **FUNCTIONAL BLOCKER** |

---

## 8. Протокол подготовки и условия допуска (Pre-boot Gates)

До выполнения любой попытки запуска тестового инстанса DSH Host обязаны быть выполнены следующие шаги:
1. **Создание изолированного synthetic-окружения**:
   - Отдельный каталог `$DSH_HOME=/tmp/dsh-017-synthetic` (строго проверенный, непустой абсолютный путь).
   - Запрет монтирования или копирования живых сессий и настроек.
   - Запрет запуска с указанием на production `$DSH_HOME`; использование изолированного каталога `$DSH_HOME` гарантирует отсутствие автоматической мутации рабочих настроек в `settings.yaml.imported`.
2. **Устранение функциональных блокеров**:
   - Подготовка совместимого пакета персистентности (или переход на штатный `dsh-session-persistence-jsonl`).
   - Патчинг `@openviking/dsh-memory-plugin` с миграцией события `agent/session-start` → awaited `agent/created`.
3. **Изоляция сетевого и клиентского периметра**:
   - Выделенный порт и отдельный заголовок Host/Origin, предотвращающий передачу production cookies браузера.
   - Мобильный плагин `dsh-web-mobile`: запуск только в виде изолированной канарейки без перезаписи production tgz; учитывать требование Node >=24 и обязательное сохранение локальных модификаций 2.3.1 (свайп композера, зум-хаки), если оператор не одобрит изменение поведения.
4. **Безопасность TTS**:
   - Учитывать, что прямой RPC `getChunk` доступен аутентифицированным браузерам через gateway, но не имеет per-session ACL. Избегать заявлений об анонимной уязвимости или о безопасности реализации. Требуется обязательный авторизационный guard по сессиям перед вызовом глобального поиска по всем сессиям.
