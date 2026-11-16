# 026 — Задачі

- [x] **T1** (REQ-026-01, 02, 03, 06, 07, 09, 11) Норми й правила на бекенді: `a11y-norms.ts`,
  `findViolations(tree, image, norms)`, `UiTreeSettings.a11yNorms`, прийом знімка.
  - Файли: `backend/src/a11y/a11y-norms.ts`, `a11y.rules.ts`, `ui-tree/comparison-inputs.ts`,
    `ui-tree/ui-tree.service.ts`.
  - Готово, коли: `a11y-norms.spec.ts`, `a11y.rules.spec.ts`, `comparison-inputs.spec.ts` зелені.
- [x] **T2** (REQ-026-05, 08) Звіт за поточними нормами: `applyNorms` у рев'ю, лічильниках,
  заведенні бага й Insights; перерахунок 5 останніх білдів після збереження налаштувань.
  - Файли: `backend/src/a11y/a11y-issues.service.ts`, `analytics/analytics.service.ts`,
    `projects/projects.controller.ts`, `projects/projects.module.ts`.
  - Готово, коли: `a11y-problems.service.spec.ts` зелений.
- [x] **T3** [P] (REQ-026-04) Норма в очікуваному результаті бага.
  - Файли: `backend/src/a11y/jira-bug.ts`.
  - Готово, коли: `jira-bug.spec.ts` зелений.
- [x] **T4** (REQ-026-09, 10, 12, 14, 15) Розділ «Доступність»: `A11yRulesSettings` замість
  `A11yProblemSettings`, словники, пошук.
  - Файли: `frontend/src/components/ProjectForm/A11yRulesSettings.tsx`, `ProjectForm.tsx`,
    `pages/ProjectSettingsPage.tsx`, `types/insights.ts`, `_helpers/projectSettings.helper.ts`,
    `i18n/en.ts`, `i18n/uk.ts`.
  - Готово, коли: `projectSettings.helper.test.ts` і `projectSettings.spec.ts` зелені.
- [x] **T5** Документація: статус spec → `Implemented`, «Перевірка вимог» звірена, посилання в
  `frontend/AGENTS.md` на новий компонент, норми в гайді Android-доступності, якщо він їх називає.
- [x] **T6** `/verify`: тести, типи, лінт, еталони скриншотів, `scripts/check-docs.py`.
