# 022 — Задачі

- [x] **T1** (REQ-022-08) Перенести тести підпису з діалогу варіацій на `getChangeSignature` і
  `mapWithConcurrency`: збережений при прийомі, перерахунок після зміни конфігурації, обчислення
  без збереженого, кеш, область ігнорування, обмеження паралельності.
  - Файли: `backend/src/test-runs/test-runs.service.spec.ts`.
  - Готово, коли: нові тести зелені ще до видалення `getMatchingVariations`.
- [x] **T2** (REQ-022-03, REQ-022-08) Видалити пошук сусідів, `getMatchingVariations` і ендпоінт
  `matchingSiblings`; їхні тести; переписати коментарі біля підпису під групи змін. Тест
  маршруту → 404.
  - Файли: `backend/src/test-runs/test-runs.service.ts`, `test-runs.service.spec.ts`,
    `test-runs.controller.ts`, `test-runs.controller.spec.ts`.
  - Готово, коли: `npm test` зелений, `change-groups.service.spec.ts` не змінювався.
- [x] **T3** [P] (REQ-022-04, REQ-022-05) Проєкт в API без налаштувань варіацій: `toPublicProject`,
  `create`/`update`, `ProjectDto`, `SETTINGS_FIELDS`.
  - Файли: `backend/src/projects/projects.service.ts`, `projects.service.spec.ts`,
    `dto/project.dto.ts`, `settings-conflict.ts`, `settings-conflict.spec.ts`.
  - Готово, коли: три тести з «Перевірки вимог» зелені.
- [x] **T4** [P] (REQ-022-01) Сторінка налаштувань без перемикача й селекта; пошук і розділ
  Review без них обома мовами; поля зникають з типу `Project` і значень за замовчуванням.
  - Файли: `frontend/src/components/ProjectForm/ProjectForm.tsx`,
    `_helpers/projectSettings.helper.ts` (+ тест), `types/project.ts`, `constants/project.ts`,
    `integration_tests/test/projectSettings.spec.ts`, `projectList.spec.ts`.
  - Готово, коли: `CI=true npx jest` і обидва Playwright-файли зелені.
- [x] **T5** (REQ-022-02) Екран порівняння без «Approve variations» і «Reject variations»:
  прибрати кнопки, стан і `MatchingVariationsDialog`, метод сервісу.
  - Файли: `frontend/src/components/TestDetailsDialog/ApproveRejectButtons.tsx`,
    `TestDetailsModal.tsx`, `MatchingVariationsDialog.tsx`, `services/testRun.service.ts`,
    `integration_tests/test/testDetailsDialog.spec.ts`.
  - Готово, коли: новий тест зелений, «takes a decision back with Undo» зелений. Після T4: обидві
    задачі змінюють тип `Project`.
- [x] **T6** (REQ-022-06, REQ-022-07) Список тестів без групування: прибрати перемикач і
  `TestRunGroup`, сітка й таблиця працюють зі знімками; видалити `testRunGroup.helper.ts` і
  тести групування й «does not leave the grid on a page that no longer exists» (див. дизайн);
  переписати «forgets what was selected…» і «shows the tags on the cards».
  - Файли: `frontend/src/components/TestRunList/index.tsx`, `TestRunGrid.tsx`,
    `TestRunListControls.tsx`, `DataGridCustomToolbar.tsx`, `_helpers/testRunGroup.helper.ts`
    (+ тест), `integration_tests/test/testRunGrid.spec.ts`,
    `integration_tests/pages/components/TestRunList.ts`.
  - Готово, коли: `testRunGrid.spec.ts` зелений, зокрема вибір, сторінки й «navigates the dialog
    in the grid's order» без змін очікувань. Після T5: обидві задачі чіпають
    `ApproveRejectButtons.tsx` (імпорт хелпера).
- [x] **T7** Словники й еталони: прибрати ключі фічі з `frontend/src/i18n/en.ts` і `uk.ts`
  (тест словників зелений); перезняти в Docker еталони, де видно панель списку чи розділ
  Review, англійські й українські; переглянути кожен новий знімок. Ключі можна прибирати
  разом із T4–T6, кожна задача — свої.
- [x] **T8** Документація: статус spec → `Implemented`; `backend/AGENTS.md` без пастки про
  «siblings signatures»; `docs/architecture/data-model.md` — дві колонки `Project` як невживані;
  у 018 біля REQ-018-45 посилання на 022.
- [ ] **T9** `/verify`: тести, типи, лінт, еталони скриншотів, `scripts/check-docs.py`, сценарії
  приймання.
