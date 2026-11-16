# 022 — Дизайн

## Підхід

Прибираємо код, а не ховаємо його за прапорцем: повертати фічу, якщо знадобиться, будемо новою
специфікацією, а мертвий код поруч із групами змін лише заважав би їх читати.

Межа проходить по колірному підпису зміни. Діалог варіацій і групи змін (006) обидва
порівнюють підписи, а самі підписи пишуться при прийомі знімка. Тому з бекенду зникають лише
пошук «сусідів» і ендпоінт, а `getChangeSignature`, `mapWithConcurrency`,
`SIGNATURE_CONCURRENCY` і `magnitudesSimilar` лишаються для `ChangeGroupsService`. Тести, що
перевіряли підпис через діалог (збережений при прийомі, перерахунок після зміни конфігурації,
кеш, область ігнорування, обмеження паралельності), не видаляються, а переписуються на сам
`getChangeSignature` і `mapWithConcurrency`. Інакше групи змін втратили б покриття, якого в
`change-groups.service.spec.ts` немає: там підпис замоканий.

Налаштування проєкту зникають з API в обидва боки. `toPublicProject` не віддає дві колонки
(REQ-022-04), `create`/`update` їх не пишуть, DTO їх не описує, а `settingsConflict` їх не
порівнює. `ValidationPipe` працює без `whitelist`, тож старий клієнт, що надішле ці поля,
просто не матиме ефекту (REQ-022-05).

У списку тестів групування вшите глибше: картки й рядки будуються з `TestRunGroup`
(представник, лічильник, вибір групи цілком). Перемикач за замовчуванням вимкнений і не
запам'ятовується, тож без нього кожна група складалася б з одного знімка. Тому прибираємо і
`TestRunGroup`: сітка й таблиця працюють прямо зі знімками, а `testRunGroup.helper.ts` зникає.
Поведінка списку без групування (а саме її бачать усі за замовчуванням) не змінюється.

ADR не потрібен: рішення не обмежує майбутню роботу, причини — у spec.md.

## Компоненти

| Компонент | Шлях | Роль |
|---|---|---|
| Пошук сусідів і ендпоінт | `backend/src/test-runs/test-runs.service.ts`, `test-runs.controller.ts` | видалити `findMatchingSiblings`, `getMatchingVariations`, `SkippedSibling`, `GROUP_BY_AXES`, `resolveGroupByAxis`, `GET test-runs/matchingSiblings/:id`; коментарі біля підпису й `magnitudesSimilar` переписати під групи змін |
| Тести підпису | `backend/src/test-runs/test-runs.service.spec.ts` | `describe('getMatchingVariations')` → `describe('getChangeSignature')` і `describe('mapWithConcurrency')` |
| Маршрут | `backend/src/test-runs/test-runs.controller.spec.ts` | Nest-застосунок з контролером і supertest: запит групи варіацій → 404 |
| Проєкт в API | `backend/src/projects/projects.service.ts`, `dto/project.dto.ts`, `settings-conflict.ts` | `toPublicProject` без двох полів; `create`/`update` їх не пишуть; DTO і `SETTINGS_FIELDS` без них |
| Налаштування | `frontend/src/components/ProjectForm/ProjectForm.tsx`, `_helpers/projectSettings.helper.ts`, `types/project.ts`, `constants/project.ts` | прибрати перемикач, селект, ключі в розділі Review і в мапі поле → розділ, поля типу й значення за замовчуванням |
| Екран порівняння | `frontend/src/components/TestDetailsDialog/ApproveRejectButtons.tsx`, `TestDetailsModal.tsx`, `MatchingVariationsDialog.tsx`, `services/testRun.service.ts` | прибрати кнопки «… variations», стан діалогу, сам діалог, `getMatchingVariations` і `MatchingVariations` |
| Список тестів | `frontend/src/components/TestRunList/index.tsx`, `TestRunGrid.tsx`, `TestRunListControls.tsx`, `DataGridCustomToolbar.tsx`, `_helpers/testRunGroup.helper.ts` (+ тест) | прибрати перемикач і `TestRunGroup`; сітка, таблиця, вибір, сторінки й порядок діалогу — по знімках |
| Playwright | `frontend/integration_tests/test/testRunGrid.spec.ts`, `projectSettings.spec.ts`, `projectList.spec.ts`, `testDetailsDialog.spec.ts`, `pages/components/TestRunList.ts` | видалити тести групування й `groupToggle`; «forgets what was selected…» і «shows the tags on the cards» переписати на картки без груп; додати тести відсутності. «does not leave the grid on a page that no longer exists» видаляється: зміна фільтра сама повертає на першу сторінку, тож сторінка зникає лише тоді, коли знімки видаляють через сокет, а моки цього не відтворюють. Обмеження номера сторінки в коді лишається запобіжником |
| Словники | `frontend/src/i18n/en.ts`, `uk.ts` | прибрати ключі фічі обома мовами (`review.bulkApprove*`, `review.groupBy*`, `review.approveVariations*`, `review.rejectVariations*`, `runs.group*`, `variations.*`); `tour.variations*` — про сторінку Test Variations, лишається; тест словників вимагає однакових ключів |
| Скриншот-еталони | `frontend/integration_tests/…-snapshots/` | панель списку й розділ Review стали коротшими: перезняти в Docker ті, де вони є, англійські й українські |
| Документація | `backend/AGENTS.md`, `docs/architecture/data-model.md`, `docs/specs/018-ui-redesign/spec.md` | пастка «asks for the siblings signatures…» зникає; колонки `Project` позначити як невживані; у 018 — посилання на 022 біля вимоги про «Group variations by» |

## Дані

Схема не змінюється. `Project.bulkApproveVariations` і `Project.bulkApproveGroupBy` лишаються
з тими самими значеннями за замовчуванням, нові проєкти отримують їх від бази, і ніхто їх не
читає ([ADR-0003](../../decisions/0003-additive-schema-only.md)). `TestRun.changeSignature` і
далі пишеться при прийомі знімка — для груп змін. Фікстури й сид, що заповнюють ці колонки,
лишаються як є: вони дзеркалять рядок бази.

## Потік

Без змін для груп змін: прийом знімка → diff і підпис → `changeSignature` у рядку → групи змін
читають підпис або перераховують його через `getChangeSignature`.

## Ризики

| Ризик | Що робимо |
|---|---|
| Разом із діалогом зникне покриття кешу й перерахунку підпису, і групи змін тихо зламаються | тести переносяться на `getChangeSignature` до видалення діалогу (T1) |
| Прибирання `TestRunGroup` зламає вибір, сторінки чи порядок навігації в діалозі | Playwright-тести вибору, сторінок і «navigates the dialog in the grid's order» лишаються й мають пройти без змін очікувань |
| Масові дії зі списку плутають з bulk approve варіацій | вони йдуть через `approveBulk`/`rejectBulk`, які не чіпаємо; REQ-022-07 перевіряють наявні тести |
| Старий клієнт надсилає поля, і `IsBoolean` чи `IsString` уже не валідує їх | без `whitelist` зайві поля ігноруються; тест на `update` це фіксує |

## Перевірка вимог

| Вимога | Перевірка |
|---|---|
| REQ-022-01 | `frontend/src/_helpers/projectSettings.helper.test.ts › finds no settings for variations in either language` |
| REQ-022-01 | `frontend/integration_tests/test/projectSettings.spec.ts › has no settings for variations in the review section` |
| REQ-022-02 | `frontend/integration_tests/test/testDetailsDialog.spec.ts › offers no variations actions, even where the project had them on` |
| REQ-022-03 | `backend/src/test-runs/test-runs.controller.spec.ts › has no route for a variation group` |
| REQ-022-04 | `backend/src/projects/projects.service.spec.ts › leaves the variation settings out of a project it returns` |
| REQ-022-05 | `backend/src/projects/projects.service.spec.ts › ignores the variation settings an old page still sends` |
| REQ-022-05 | `backend/src/projects/settings-conflict.spec.ts › ignores the variation settings an old page loaded` |
| REQ-022-06 | `frontend/integration_tests/test/testRunGrid.spec.ts › shows every variation of a screen on its own card, with no grouping switch` |
| REQ-022-07 | `frontend/integration_tests/test/testRunGrid.spec.ts › approves the runs selected in the grid` |
| REQ-022-07 | `backend/src/test-runs/decision-undo.spec.ts › undoes a bulk decision all or nothing` |
| REQ-022-08 | `backend/src/test-runs/change-groups.service.spec.ts › groups runs of one screen with matching change signatures…` |
| REQ-022-08 | `backend/src/test-runs/test-runs.service.spec.ts › uses the signature stored at ingest without decoding anything` |
