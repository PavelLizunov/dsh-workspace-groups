# План доработки dsh-workspace-groups

## Цель

Довести форк до состояния, в котором его можно безопасно установить в основной DSH Web profile и ежедневно использовать при большом количестве Workspace. Сначала исправляем подтверждённые ошибки и защищаем данные, затем восстанавливаем полноценный UX, проверяем совместимость и только после этого оптимизируем масштабирование.

Исходная точка и доказательства: [`AUDIT.md`](./AUDIT.md). Работа ведётся в форке `PavelLizunov/dsh-workspace-groups`; upstream `z-col/dsh-workspace-groups` сохраняется отдельным remote.

## Неподвижные требования

- Плагин не удаляет и не перемещает каталоги проектов.
- Плагин не изменяет официальные workspace/session storage DSH.
- Все ручные группы и порядок хранятся только в plugin-owned overlay.
- Запись overlay атомарна и защищена от потери параллельных изменений.
- Все действия, которые видны в интерфейсе, либо работают, либо не отображаются.
- Основные действия доступны мышью, клавиатурой и на touch-устройствах.
- Поддерживаемая версия DSH подтверждается живым тестом, а не только peerDependencies.
- Исправление считается завершённым только после тестов, сборки, проверки GUI, коммита и push.

## Этап 1 — Correctness и защита данных

- [x] Исправить нормализацию путей для `/` и `\\`, корневых путей и Windows drive letter.
- [x] Сделать `pathPrefix` сравнением по границе сегмента, а не строковым `startsWith`.
- [x] Пропускать скрытые правила и корректно обрабатывать назначения в скрытые/удалённые группы.
- [x] Зарезервировать `__topLevel__` на Host и Client boundaries.
- [x] Сделать self-drop гарантированным no-op.
- [ ] Исправить первый reorder внутри группы на основе текущего эффективного порядка.
- [ ] Сохранять существующий пользовательский порядок при повторном top-level reorder.
- [ ] Сериализовать изменения overlay и добавить revision/ETag conflict detection.
- [ ] Добавить регрессионные тесты на каждый перечисленный случай.

**Готово, когда:** правила одинаково работают на Linux/macOS/Windows fixtures; быстрые и параллельные операции не теряют данные; DnD tests фиксируют точный порядок.

## Этап 2 — Функциональный UI

- [ ] Подключить реальные Workspace/Session actions в результатах поиска либо убрать недоступные кнопки.
- [ ] Показывать ошибки fork/archive и дать retry для config/manual failures.
- [ ] Защитить модальные операции от stale promise settlement и повторного открытия другой сущности.
- [ ] Исправить rail mode и поведение Add Workspace при свернутом sidebar.
- [ ] Гарантировать раскрытие целевой группы после успешного drop.
- [ ] Добавить browser/component tests для поиска, диалогов и DnD.

**Готово, когда:** каждый видимый action работает и ошибки видны пользователю; поиск не меняет семантику операций и порядка.

## Этап 3 — Accessibility

- [x] Добавить базовый keyboard focus и Enter/Space activation для Group, Workspace и Session rows в рамках DSH-native redesign.
- [ ] Реализовать roving focus и полную WAI-ARIA Tree keyboard navigation.
- [x] Исправить accessible names категорий и search input.
- [ ] Добавить меню «Переместить в группу», «Выше», «Ниже» как альтернативу drag-and-drop.
- [x] Сделать row actions доступными без hover и на touch-устройствах.
- [ ] Добавить live announcements для перемещения и ошибок.

**Промежуточный статус:** DSH-native redesign добавляет фокус, Enter/Space activation, корректные accessible names и touch-visible actions; roving focus, Arrow navigation, keyboard move actions и live announcements остаются открыты.

**Готово, когда:** основной сценарий группировки и сортировки полностью выполняется только клавиатурой; axe/manual screen-reader smoke не показывает blocker-ошибок.

## Этап 4 — Build, тестовый gate и совместимость DSH

- [ ] Исправить `verify-groups.mjs`: setup failure и 0/0 всегда дают exit 1.
- [ ] Сделать поиск Chrome переносимым между Linux/macOS/Windows.
- [ ] Убрать абсолютный builder path из `lib/client.js`.
- [ ] Проверить и исправить public `.d.ts` imports с расширениями `.ts` через consumer fixture.
- [ ] Включить tests в TypeScript typecheck.
- [ ] Добавить `README_ZH.md` и config example в package tarball.
- [ ] Выбрать минимальную поддерживаемую DSH-версию и выровнять peers.
- [ ] Установить fork в отдельный disposable profile и выполнить живой GUI suite.
- [ ] Только после успешного disposable-profile gate устанавливать в основной `web` profile.

**Готово, когда:** чистый checkout воспроизводимо собирается без diff; fail-closed test gate зелёный; tarball проходит consumer install; заявленные DSH-версии подтверждены.

## Этап 5 — Масштабирование

- [ ] Заменить повторные `find/includes` на заранее построенные Map/Set indices.
- [ ] Вычислять subagent descendants один раз на snapshot.
- [ ] Разделить count для свернутых Workspace и создание SessionNode для раскрытых.
- [ ] Сделать подписки на session store более узкими и добавить memo boundaries.
- [ ] Батчить массовое сворачивание/восстановление при DnD.
- [ ] Измерить 100/500/1000 Workspace; виртуализацию добавлять только при подтверждённой необходимости.

**Готово, когда:** зафиксированы benchmark fixtures и UI остаётся отзывчивым на согласованном целевом объёме.

## Порядок работы в новой сессии

1. Прочитать `AUDIT.md` и этот файл.
2. Проверить `git status`, `origin`, `upstream` и актуальность upstream.
3. Создать рабочую ветку от `main`; ветку `audit/full-plugin-review` оставить как доказательную.
4. Брать по одному связанному набору проблем из этапа 1.
5. Сначала добавить падающий регрессионный тест, затем минимальное исправление.
6. Выполнить `pnpm typecheck`, `pnpm test`, `pnpm build` и релевантный live check.
7. Обновить этот checklist и `AUDIT.md`, если вывод изменился.
8. Сделать Conventional Commit и push после каждого проверенного набора.

## Первый рекомендуемый набор

Начать с чистого core-пакета, не затрагивая React:

1. path normalization + segment-boundary matching;
2. hidden-rule fallback;
3. reserved `__topLevel__`;
4. self-drop no-op;
5. unit tests для Linux/macOS/Windows counterexamples.

Статус: выполнено в ветке `fix/core-english-first`; дополнительно primary runtime/docs переведены на English-first, а китайская локаль изолирована в `src/client/locales/zh.ts` и `README_ZH.md`.

После этого отдельным набором исправить reorder в `GroupsBrowser.tsx` и покрыть его извлечёнными чистыми функциями, не пытаясь одновременно переписать весь UI.
