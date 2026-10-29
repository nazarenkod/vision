# 020 — Дизайн

## Підхід

Це видалення коду, а не даних. Три довідкові аналізи (порівняння з еталонним пристроєм,
«знято зарано», «не той екран») прибираємо повністю: налаштування, обчислення, API, інтерфейс,
CLI. Колонки й таблиця, куди вони писали, лишаються ([ADR-0003](../../decisions/0003-additive-schema-only.md)):
у них просто більше нічого не пишемо й нічого з них не читаємо.

- **Бекенд.** Модуль `cross-device.ts` і функції `detectLoading`, `screenSimilarity`,
  `screenFingerprint` видаляємо разом з їхніми тестами. `UiTreeService.analyze` більше не
  повертає `warnings`, `structure` — теж. Вибір еталона іншого пристрою (`otherDeviceBaseline`)
  лишається для перевірки доступності, але сортує лише за гілкою й свіжістю, без налаштувань.
  Рішення рев'юера більше не запускає порівняння з еталонним пристроєм.
- **Налаштування проєкту.** Поля `detectLoading`, `detectScreenMismatch`, `referenceDevice`
  зникають з типу `UiTreeSettings` на обох боках і з парсера бекенду. Збережений JSON не
  чистимо: фронтенд розбирає його через spread і зберігає невідомі ключі назад як є
  (REQ-020-05), а бекенд їх просто не читає.
- **Фронтенд.** Прибираємо два перемикачі й вибір пристрою, вкладку Devices, позначки Loading /
  Other screen? і попередження в Changes, рядок «taken while loading» в Insights. Тип
  `CaptureWarning` і `captureWarnings()` видаляємо, тож старі збережені попередження ніде не
  показуються (REQ-020-10), хоча сокет і далі розсилає рядок `TestRun` з колонкою.
- **CLI.** Не друкує `Warning:` з відповіді: її більше немає.

Чому не лишити обчислення «на майбутнє» за вимкненим прапорцем: код, що нічого не показує, ніхто
не підтримує, а тести на нього тримають трасування живим. Якщо колись знадобиться, він є в історії
git (останній коміт до цієї зміни). Рішення щодо порівняння пристроїв — [ADR-0016](../../decisions/0016-no-cross-device-comparison.md).

## Компоненти

| Компонент | Шлях | Роль |
|---|---|---|
| Порівняння пристроїв | `cross-device.ts`, `cross-device.spec.ts` у `backend/src/ui-tree/` | видаляємо |
| Перевірки екрана | `backend/src/ui-tree/screen-checks.ts`, `.spec.ts` | без `detectLoading`, `screenFingerprint`, `screenSimilarity`, `MISMATCH_BELOW`, `SAME_SCREEN_ABOVE`, `CaptureWarning*`; `invisibleChanges` і `componentChanges` лишаються |
| Налаштування дерева | `backend/src/ui-tree/comparison-inputs.ts`, `.spec.ts` | без трьох полів у типі, типових значеннях і парсері; `sameDevice`/`DeviceProfile` — видалити, якщо після зміни не використовуються |
| Аналіз дерева | `backend/src/ui-tree/ui-tree.service.ts`, `.spec.ts` | без `crossDevice`, `recordCrossDevice`, `CrossDeviceResult`, `screenWarnings`, `warnings` в `analyze` і `structure`; `otherDeviceBaseline(testRun, project)` без `settings` |
| Прогони | `backend/src/test-runs/test-runs.service.ts`, `.spec.ts` | `setStatus` без порівняння; без `getCrossDevice`; `analyzeUiTree` не пише `captureWarnings` |
| API прогонів | `backend/src/test-runs/test-runs.controller.ts`, `.spec.ts` | без `GET :id/cross-device` |
| Відповідь на знімок | `backend/src/test-runs/dto/testRunResult.dto.ts`, новий `testRunResult.dto.spec.ts` | без `warnings` |
| DTO прогону | `backend/src/test-runs/dto/testRun.dto.ts` | без `captureWarnings` |
| Журнал Undo | `backend/src/test-runs/decision-undo.spec.ts` | мок без `recordCrossDevice` |
| Пристрої проєкту | `backend/src/projects/projects.controller.ts`, `projects.service.ts` | без `GET :id/devices` і `devices()`: їх викликав лише вибір еталонного пристрою |
| Insights | `backend/src/analytics/insights.ts`, `analytics.service.ts`, `insights.spec.ts` | `captureIssues` без `loading`: перевірки з `hidden ≥ 2` |
| Налаштування (UI) | `frontend/src/components/ProjectForm/ProjectForm.tsx` | `TOGGLES` без двох рядків; без вибору пристрою й запиту пристроїв |
| Пошук і зміни налаштувань | `frontend/src/_helpers/projectSettings.helper.ts`, `.test.ts` | без трьох міток і ключів у `TREE_SECTION` |
| Типи | `frontend/src/types/insights.ts`, `testRun.ts` | без трьох полів налаштувань, `CaptureWarning`, `captureWarnings()`, типів порівняння пристроїв, `captureIssues.loading`, `TestRun.captureWarnings` |
| API-клієнт | `frontend/src/services/insights.service.ts` | без `getProjectDevices` і запиту порівняння пристроїв |
| Ревю знімка | `frontend/src/components/TestDetailsDialog/InsightsPanel.tsx`; `CrossDevicePanel.tsx` | без вкладки Devices і попереджень у Changes (лічильник на вкладці — лише приховані зміни); панель видаляємо |
| Позначки знімка | `frontend/src/components/ChangeGroups.tsx` (`RunFlags`), новий `RunFlags.test.tsx` | лише «N hidden» |
| Insights (UI) | `frontend/src/pages/InsightsPage.tsx`, `integration_tests/test/insights.spec.ts` | лише приховані зміни; підказка без «taken while loading» |
| CLI | `frontend/public/cli/vision.py`, `scripts/tests/test_vision_cli.py` | без рядків `Warning:` з відповіді |
| Документація | див. T9 у [tasks.md](tasks.md) | 002, 003, 007, 008, ADR, архітектура, глосарій, огляд, DEMO.md, AGENTS.md пакетів |

## Дані

Міграцій немає.

| Що | Було | Після |
|---|---|---|
| Таблиця `CrossDeviceCheck` | запис на кожне Approve/Reject і відкриття вкладки Devices | лишається з наявними рядками; нових немає (REQ-020-04) |
| `TestRun.captureWarnings` | JSON попереджень | лишається; нові прогони — `null`; ніхто не читає |
| `Project.uiTreeSettings` → `referenceDevice`, `detectLoading`, `detectScreenMismatch` | читалися бекендом | лишаються в JSON як є; бекенд ігнорує; форма зберігає їх назад без змін |

## Потік

Прийом знімка: порівняння пікселів → `analyzeUiTree` → звіт доступності (за власним еталоном або
еталоном іншого пристрою: гілка прогону перед основною, далі найсвіжіший) + приховані зміни +
компоненти. Кроку «попередження зйомки» більше немає, у відповідь SDK/CLI йде статус, дифф і
доступність.

Рішення рев'юера: `setStatus` → оновлення рядка й подія сокета. Більше нічого.

## Ризики

| Ризик | Що робимо |
|---|---|
| Паралельно йде 022 (гілка `remove-variation-groups` у цьому ж checkout): та сама сторінка налаштувань (`ProjectForm.tsx`, `projectSettings.helper.ts`, `projectSettings.spec.ts`) | Реалізуємо після злиття 022, гілкою від неї; не раніше |
| Українізація інтерфейсу (023, ADR-0017) потрапить у main раніше й змінює `ProjectForm.tsx`, `InsightsPanel.tsx`, `ProjectSettingsPage.tsx` і словники `i18n` | Реалізуємо поверх неї: разом з елементами прибираємо їхні ключі з `frontend/src/i18n/en.ts` і `uk.ts`; новий текст, якщо з'явиться, — лише через `useT()`. Перед комітом — `git fetch vision` і rebase на свіжий `vision/main`, рядки індексів (`docs/specs/README.md`, `docs/decisions/README.md`) зберігаємо обидва |
| Трасування 002, 003, 007, 008 посилається на тести, які видаляємо | Попередження зйомки в 002 і всі вимоги 007 → `manual: знято 020`; еталон іншого пристрою в 003 → новий тест його вибору; Insights у 008 → перейменований тест |
| Вибір еталона іншого пристрою зміниться непомітно й зламає звіти доступності нових пристроїв | Окремі тести на гілку, свіжість і ігнорування колишнього вибору (REQ-020-06, 07) |
| Збережений `referenceDevice` (об'єкт) зламає форму, коли тип його більше не знає | Тест збереження з усіма трьома старими ключами (REQ-020-05) |
| Скриншот-еталони Playwright містили позначки чи розділ Mobile screenshots | Моки не мають `captureWarnings`; `/verify` ганяє скриншот-тести, нові еталони — лише якщо змінився знятий екран (ADR-0011) |

## Перевірка вимог

| Вимога | Перевірка |
|---|---|
| REQ-020-01 | `frontend/src/_helpers/projectSettings.helper.test.ts › finds no reference device and no warning switches`; `frontend/integration_tests/test/projectSettings.spec.ts › has no reference device and no warning switches` |
| REQ-020-02 | `frontend/integration_tests/test/testDetailsDialog.spec.ts › has no Devices tab and no capture warnings`; `backend/src/test-runs/test-runs.controller.spec.ts › serves no reference device comparison` |
| REQ-020-03 | `backend/src/test-runs/test-runs.service.spec.ts › setStatus compares nothing with a reference device` |
| REQ-020-04 | manual: `select count(*) from "CrossDeviceCheck"` до розгортання й через 7 днів однаковий; у зміні немає міграцій |
| REQ-020-05 | `frontend/integration_tests/test/projectSettings.spec.ts › keeps settings it no longer shows when saving` |
| REQ-020-06 | `backend/src/ui-tree/ui-tree.service.spec.ts › takes the newest baseline of the check on another device, on the run branch first` |
| REQ-020-07 | `backend/src/ui-tree/ui-tree.service.spec.ts › ignores a reference device chosen before` |
| REQ-020-08 | `frontend/src/_helpers/projectSettings.helper.test.ts › finds no reference device and no warning switches`; `frontend/integration_tests/test/projectSettings.spec.ts › has no reference device and no warning switches` |
| REQ-020-09 | `backend/src/ui-tree/ui-tree.service.spec.ts › warns about neither a spinner nor another screen` |
| REQ-020-10 | `frontend/src/components/RunFlags.test.tsx › shows hidden changes but no warnings saved before`; `frontend/integration_tests/test/testDetailsDialog.spec.ts › has no Devices tab and no capture warnings` |
| REQ-020-11 | `backend/src/test-runs/dto/testRunResult.dto.spec.ts › leaves out capture warnings kept on the run` |
| REQ-020-12 | `backend/src/analytics/insights.spec.ts › points at noise and hidden changes` |
