# 019 — Задачі

- [x] **T1** (REQ-019-01, REQ-019-04) Прибрати розділ правил зі сторінки налаштувань.
  - Файли: `projectSettings.helper.ts` і його тест, `ProjectSettingsPage.tsx`, `ProjectForm.tsx`
    (`MobileSettings`), `projectSettings.spec.ts`.
  - Готово, коли: у змісті 7 розділів; тести «has no element rules section» і «keeps the
    project's element rules when saving» зелені; тест «refuses an element rule without…» і
    `ruleSelectorError` видалено.
- [x] **T2** [P] (REQ-019-02, 03, 05) Підтвердження перед Remove правила для всіх екранів.
  - Файли: `InsightsPanel.tsx`, новий `frontend/integration_tests/test/elementRules.spec.ts`.
  - Готово, коли: три тести в `elementRules.spec.ts` зелені.
- [x] **T3** Документація: у 018 звузити REQ-018-41, 42, 45, зняти REQ-018-51 (спека й рядок у
  «Перевірці вимог»), додати посилання на 019; статус 019 → `Implemented`.
- [ ] **T4** `/verify`: тести, типи, лінт, `scripts/check-docs.py`, сценарії приймання 1–4.
