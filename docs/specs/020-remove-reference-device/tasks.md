# 020 — Задачі

Починати після того, як у `vision/main` потраплять 022 (та сама сторінка налаштувань) і
українізація 023, гілкою від свіжого `vision/main`. T1–T3 — бекенд, T4–T7 — фронтенд і CLI; між
собою групи не перетинаються файлами. У T4–T6 разом з елементами інтерфейсу прибираємо їхні
ключі з `frontend/src/i18n/en.ts` і `uk.ts` (T4, T5, T6 правлять словники — тому вони
послідовні). Номери 023 і ADR-0017 зайняті українізацією.

- [ ] **T1** (REQ-020-03, REQ-020-04, REQ-020-02, REQ-020-06, REQ-020-07) Бекенд: прибрати
  порівняння пристроїв.
  - Файли: видалити `backend/src/ui-tree/cross-device.ts`, `cross-device.spec.ts`;
    `ui-tree.service.ts` (без `crossDevice`, `recordCrossDevice`, `CrossDeviceResult`;
    `otherDeviceBaseline` без `settings`), `ui-tree.service.spec.ts`;
    `test-runs.service.ts` (`setStatus`, `getCrossDevice`), `test-runs.service.spec.ts`;
    `test-runs.controller.ts`, `test-runs.controller.spec.ts`; `decision-undo.spec.ts`;
    `projects.controller.ts`, `projects.service.ts` (`devices`).
  - Готово, коли: зелені `ui-tree.service.spec.ts › takes the newest baseline of the check on
    another device…`, `› ignores a reference device chosen before`,
    `test-runs.service.spec.ts › setStatus compares nothing with a reference device`,
    `test-runs.controller.spec.ts › serves no reference device comparison`; `decision-undo.spec.ts`
    зелений.
- [ ] **T2** (REQ-020-09, REQ-020-11) Бекенд: прибрати попередження зйомки.
  - Файли: `screen-checks.ts`, `screen-checks.spec.ts`; `comparison-inputs.ts`,
    `comparison-inputs.spec.ts` (три поля); `ui-tree.service.ts` (`analyze`, `structure`,
    `screenWarnings`); `test-runs.service.ts` (`analyzeUiTree`); `dto/testRun.dto.ts`,
    `dto/testRunResult.dto.ts`, новий `dto/testRunResult.dto.spec.ts`.
  - Залежить від T1 (ті самі `ui-tree.service.ts`, `test-runs.service.ts`).
  - Готово, коли: зелені `ui-tree.service.spec.ts › warns about neither a spinner nor another
    screen`, `testRunResult.dto.spec.ts › leaves out capture warnings kept on the run`;
    `parseUiTreeSettings` не повертає трьох полів.
- [ ] **T3** [P] (REQ-020-12) Insights без «знято зарано».
  - Файли: `backend/src/analytics/insights.ts`, `analytics.service.ts`, `insights.spec.ts`.
  - Готово, коли: `insights.spec.ts › points at noise and hidden changes` зелений.
- [ ] **T4** (REQ-020-01, REQ-020-08, REQ-020-05) Сторінка налаштувань.
  - Файли: `frontend/src/components/ProjectForm/ProjectForm.tsx`,
    `frontend/src/_helpers/projectSettings.helper.ts`, `.test.ts`,
    `frontend/integration_tests/test/projectSettings.spec.ts` (пошук «loading» і зняття
    перемикача замінити на наявне налаштування).
  - Готово, коли: зелені `projectSettings.helper.test.ts › finds no reference device and no
    warning switches`, `projectSettings.spec.ts › has no reference device and no warning
    switches`, `› keeps settings it no longer shows when saving`.
- [ ] **T5** (REQ-020-02, REQ-020-10) Ревю знімка й позначки.
  - Файли: видалити `CrossDevicePanel.tsx`; `InsightsPanel.tsx`; `ChangeGroups.tsx` (`RunFlags`),
    новий `frontend/src/components/RunFlags.test.tsx`; `frontend/src/types/insights.ts`,
    `types/testRun.ts`; `services/insights.service.ts`;
    `integration_tests/test/testDetailsDialog.spec.ts`.
  - Залежить від T4 (`types/insights.ts`, `insights.service.ts` — спільні з формою).
  - Готово, коли: зелені `RunFlags.test.tsx › shows hidden changes but no warnings saved before`,
    `testDetailsDialog.spec.ts › has no Devices tab and no capture warnings`; `tsc` без нових
    помилок.
- [ ] **T6** (REQ-020-12) Insights (UI).
  - Файли: `frontend/src/pages/InsightsPage.tsx`, `integration_tests/test/insights.spec.ts`,
    `integration_tests/test/errors.spec.ts` (мок `captureIssues`).
  - Залежить від T5 (`types/insights.ts`).
  - Готово, коли: Playwright `insights.spec.ts` зелений без «taken while loading».
- [ ] **T7** [P] (REQ-020-11) CLI.
  - Файли: `frontend/public/cli/vision.py`, `scripts/tests/test_vision_cli.py`.
  - Готово, коли: `python3 -m unittest scripts/tests/test_vision_cli.py` зелений, мок відповіді
    без `warnings`.
- [ ] **T8** [P] ADR: [ADR-0016](../../decisions/0016-no-cross-device-comparison.md) → `Accepted`,
  ADR-0006 → `Superseded by ADR-0016`, рядки в `docs/decisions/README.md`.
- [ ] **T9** Документація: статус 020 → `Implemented`; у 002 біля REQ-002-21/22/24 і в 007 —
  «знято 020», трасування → `manual: знято 020`; REQ-003-07 у 003/design.md → новий тест вибору
  еталона; REQ-008-05 у 008 — без «знято зарано», трасування → новий тест;
  `docs/architecture/api.md`, `overview.md` (без `cross-device`, `projects/:id/devices`),
  `data-model.md` («не пишеться з 020» для `CrossDeviceCheck` і `captureWarnings`);
  `docs/product/glossary.md`, `overview.md`; `DEMO.md` (пункти 9, 10, розділ Reference device,
  SQL-запит); `backend/AGENTS.md`, `frontend/AGENTS.md` (модулі й `CrossDevicePanel`).
- [ ] **T10** `/verify`: тести, типи, лінт, еталони скриншотів, `scripts/check-docs.py`, сценарії
  приймання US-1…US-3 на локальному стенді.
