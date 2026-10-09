# Spec: Перенос вкладок Limits, API Keys и Fleet Cleaner в штатную правую панель DSH

## 1. Intent & Invariants
- What: `dsh-cpamc-limits` (вкладки Limits и API Keys) и `dsh-fleet-cleaner` (вкладка Fleet Cleaner) регистрировали свой UI только через сервис `betterSidebar` стороннего плагина `dsh-better-sidebar`, который снят. Штатная правая панель ядра (`@deepseek-ai/dsh-client-ui-sidebar-right`, вкладки Files и Start) осталась и принимает вкладки через `ctx.sidebarRightTabs.register(...)` плюс слоты `sidebar.right.pane.tab` и `sidebar.right.pane.tab.title`. Переключаем регистрацию трёх вкладок на этот механизм, не возвращая `dsh-better-sidebar`.
- Invariants:
  - Загрузка веба не зависит от `betterSidebar`. Ни один `inject` снова не требует сервис снятого плагина: именно обязательный `inject` ронял весь веб с ошибкой `pending (waiting for service: betterSidebar)`.
  - Существующие компоненты вкладок не переписываются. Они самодостаточны: сами запрашивают данные и не читают `sessionId`, `useStore`, `actions`. Обёртка только встраивает их в слот и игнорирует лишние пропсы.
  - Если штатная панель по какой-то причине отсутствует, регистрация пропускается и веб всё равно поднимается.
  - `dsh-better-sidebar` остаётся выключенным (`disabled: true` в `cordis.patch.yml` профиля `web-015`).
  - Правка попадает и в репозиторий, и в копию, которую реально грузит профиль. Профиль берёт `dsh-cpamc-limits` из tarball-копии в `node_modules`, а не из `Project/ai-gateway`, поэтому правка только исходника не подействует. `dsh-fleet-cleaner` подключён симлинком, его `src/client.js` грузится напрямую.
  - Никакого `pnpm install` и `dsh plugin add` в профиле: это заново разворачивает tarball-зависимости и откатывает плагины.

## 2. Interface / Data Contract
Образец — `@deepseek-ai/dsh-client-ui-sidebar-files`:

```js
const inject = ["slots", "locale", "sidebarRightTabs", "remote", "remote.workspaceFiles"];
ctx.effect(() => ctx.sidebarRightTabs.register({
  id, kind, priority: "builtin", title: () => label, guide: [{ order, title, description, icon }],
}));
ctx.effect(() => ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register(
  { name: "sidebar.right.pane.tab", key: id, locale, store, inject }, Body)));
ctx.effect(() => ctx.slots.inject("sidebar.right.pane.tab.title", () => ctx.slots.register(
  { name: "sidebar.right.pane.tab.title", key: id }, Title)));
```

Контракт для наших вкладок, по одному набору на каждую (limits, api-keys, fleet-cleaner):

```js
inject: ["slots", "sidebarRightTabs"]   // сервисы ядра, присутствуют всегда
ctx.sidebarRightTabs.register({ id, kind: id, title: () => label })
ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register(
  { name: "sidebar.right.pane.tab", key: id },
  () => h(ExistingTabComponent)))          // компонент без пропсов слота
ctx.slots.inject("sidebar.right.pane.tab.title", () => ctx.slots.register(
  { name: "sidebar.right.pane.tab.title", key: id },
  () => label))
```

Доступ к сервисам только после объявления их в `inject` либо через `ctx.get`: прямой `ctx.sidebarRightTabs` без `inject` бросает `cannot get property "sidebarRightTabs" without inject` и снова роняет загрузку.

Файлы:
- `/var/lib/dsh/Project/dsh-fleet-cleaner/src/client.js` и его `package.json` (`dsh.client.inject`).
- `/var/lib/dsh/Project/ai-gateway/plugins/dsh-cpamc-limits/lib/client.js` и его `package.json`.
- Установленная копия `/var/lib/dsh/.dsh-releases/v015-rc2-t4x7mz4n/profile/node_modules/dsh-cpamc-limits/`, потому что профиль грузит её, а не репозиторий.

## 3. Verification Checklist (Definition of Done)
- [ ] `node --check` проходит для обоих клиентских бандлов.
- [ ] `dsh.client.inject` обоих плагинов не содержит `betterSidebar` и содержит только сервисы ядра.
- [ ] После перезагрузки клиента граф `/plugins/events` содержит `dsh-cpamc-limits` и `dsh-fleet-cleaner` и не содержит `dsh-better-sidebar`.
- [ ] В правой панели рядом с Files и Start появляются Limits, API Keys и Fleet Cleaner и показывают данные.
- [ ] Если регистрацию слота убрать, веб всё равно поднимается, без ошибки `Failed to load plugins`.
- [ ] Тест `dsh-fleet-cleaner` (`tests/native-cordis-integration.test.mjs`) обновлён под новую регистрацию и проходит.
- [ ] Рестарт `dsh-web` выполняется один раз и только после проверки дампа конфига; чаты при этом обрываются, это названо заранее.

Открытые вопросы к ревью:
1. Достаточно ли для показа вкладки регистрации типа и слота тела, или заголовок чипа обязателен и без него вкладка не видна?
2. Безопасно ли объявлять `sidebarRightTabs` и `slots` в `inject` как обязательные, учитывая, что они из базового бандла и присутствуют всегда?
3. Примет ли слот `sidebar.right.pane.tab` компонент, который игнорирует переданные ему пропсы контекста сессии?
4. Какое значение `priority` не вытеснит штатные Files и Start?
5. Есть ли менее ломкий путь донести правку `dsh-cpamc-limits` до профиля, чем ручное редактирование установленной tarball-копии?
