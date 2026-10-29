# 021 — Задачі

- [x] **T1** (REQ-021-03…06, REQ-021-08, REQ-021-10) Фіксоване групування в чистій логіці.
  - Файли: `backend/src/a11y/a11y-problems.ts`, `backend/src/a11y/a11y-issues.ts`, їхні `*.spec.ts`.
  - Прибрати класи, налаштування, режим `class`, параметр `settings`; `isComponentProblem` лише
    для `c:`; маркери без мітки класу. Тести класів видалити, «follows the per-rule settings»
    замінити тестами REQ-021-04/05, тест зміни налаштувань переписати на проблеми з фактами,
    вирішеними за іншим групуванням.
  - Готово, коли: `npm test` у `backend/` зелений.
- [x] **T2** (REQ-021-07, REQ-021-09) Сервіс і парсер налаштувань не знають про режими й класи.
  - Файли: `backend/src/a11y/a11y-issues.service.ts`, `backend/src/ui-tree/comparison-inputs.ts`,
    `backend/src/a11y/a11y-problems.service.spec.ts`, `backend/src/ui-tree/comparison-inputs.spec.ts`.
  - Залежить від T1. Тест REQ-004-34 перевести з режиму `screen` на проблему з двома розмірами
    одного компонента.
  - Готово, коли: `npm test` і `npx tsc --noEmit -p tsconfig.json` у `backend/` зелені.
- [x] **T3** [P] (REQ-021-01, REQ-021-02) Розділ налаштувань — лише заголовок екрана.
  - Файли: `frontend/src/components/ProjectForm/A11yProblemSettings.tsx`,
    `frontend/src/_helpers/projectSettings.helper.ts` (+ `.test.ts`), `frontend/src/pages/ProjectSettingsPage.tsx`,
    `frontend/integration_tests/test/projectSettings.spec.ts` (тест класів → тест REQ-021-01).
  - Готово, коли: `CI=true npx jest` і `npx playwright test projectSettings` зелені.
- [x] **T4** [P] Типи й панель доступності без класів.
  - Файли: `frontend/src/types/insights.ts`, `frontend/src/components/TestDetailsDialog/InsightsPanel.tsx`.
  - Готово, коли: `npx tsc --noEmit -p .` у `frontend/` не додає помилок до базових 25;
    `npx playwright test a11yProblems` зелений.
- [x] **T5** Документація.
  - 004 `design.md`: REQ-004-10…17 → `manual: знято [021]`, REQ-004-02 і REQ-004-05…07, REQ-004-31
    → нові назви тестів; 004 `spec.md` «Пов'язане» → посилання на 021.
  - 018 `design.md`: REQ-018-46 → `manual: знято [021]`.
  - `docs/product/glossary.md` (класи, режим дублів), `docs/architecture/data-model.md`
    (`a11yDuplicates`, `a11yClasses` — не читаються), ADR-0008 (примітка), `backend/AGENTS.md`,
    `frontend/AGENTS.md`.
  - Статус 021 → `Implemented`.
- [x] **T6** `/verify`: тести, типи, лінт змінених файлів, `python3 -I scripts/check-docs.py`;
  перевірка припущення на копії даних (запит із design.md «Дані»), сценарії приймання US-1 у UI.
  Копії даних проду на машині розробки немає: запит із «Дані» лишається ручним кроком на сервері.
