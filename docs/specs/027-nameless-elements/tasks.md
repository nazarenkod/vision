# 027 — Задачі

Експеримент: коміти лише цієї фічі, без попутних правок, щоб відкат був одним `git revert`.

- [x] **T1** (REQ-027-13, REQ-027-30, REQ-027-31) `parseXpath` і `evaluateXpath` з кодами причин.
  - Файли: `backend/src/ui-tree/xpath-selector.ts`, `xpath-selector.spec.ts`, фікстури
    `__fixtures__/android-offers.xml`, `ios-offers.xml`. Очікування для REQ-027-13 записані з
    `xpath@0.0.34` над `@xmldom/xmldom` у scratchpad: залежність у репозиторій не додаємо, бо
    `node_modules` спільні для всіх worktree.
  - Готово, коли: тести `xpath-selector.spec.ts` зелені.
- [x] **T2** (REQ-027-14, REQ-027-21) `findBySelector` і `selectorProblem`; `resolveRules` і
  `matchesOf` через них.
  - Файли: `backend/src/ui-tree/comparison-inputs.ts`, `compare-only.ts` і їхні spec.
  - Готово, коли: нові тести зелені, а наявні тести `comparison-inputs.spec.ts`,
    `compare-only.spec.ts` і `a11y-problems.spec.ts` не змінились і зелені.
- [x] **T3** (REQ-027-10, REQ-027-11, REQ-027-15, REQ-027-16) `selectorVariants`.
  - Файли: `backend/src/ui-tree/selector-variants.ts`, `selector-variants.spec.ts`.
  - Готово, коли: тести зелені, зокрема лапки в значенні опори.
- [x] **T4** (REQ-027-01, REQ-027-02, REQ-027-17, SC-027-04) безіменні елементи в
  `pickableElements`.
  - Файли: `backend/src/ui-tree/selector-variants.ts`, `ui-tree.service.ts`,
    `pickable-elements.spec.ts`.
  - Готово, коли: нові тести зелені; наявні тести іменованих елементів не змінились; тест часу
    на 2 000 вузлах < 500 ms.
- [x] **T5** (REQ-027-32, REQ-027-31) `selectorProblem` в `addElementRule` і
  `replaceAreaWithElement`; `GET :id/selector-matches`.
  - Файли: `backend/src/test-runs/test-runs.service.ts`, `test-runs.controller.ts`,
    `test-runs.service.spec.ts`.
  - Готово, коли: тести сервісу зелені; `docs/architecture/api.md` має новий запит.
- [x] **T6** [P після T4] (REQ-027-03, REQ-027-04, REQ-027-05) типи, хелпери, словники.
  - Файли: `frontend/src/types/insights.ts`, `_helpers/elementPicking.helper.ts`,
    `elementPicking.helper.test.ts`, `i18n/en.ts`, `uk.ts`.
  - Готово, коли: `CI=true npx jest` зелений, `tsc` без нових помилок.
- [x] **T7** (REQ-027-12, REQ-027-20, REQ-027-22) підказка біля елемента: підпис, попередження,
  варіанти, селектор у дію.
  - Файли: `ElementPopover.tsx`, `TestDetailsModal.tsx`, `integration_tests/test/elementSelection.spec.ts`
    з моком структури, де є безіменний елемент.
  - Готово, коли: нові Playwright-тести зелені; еталони скриншотів, якщо підказка в них є,
    оновлені в Docker з копії (не у worktree).
- [x] **T8** (REQ-027-31, REQ-027-32) повна форма правила: `xpath:` дозволено, лічильник і
  причина.
  - Файли: `InsightsPanel.tsx`, `services/insights.service.ts`, `elementSelection.spec.ts`.
  - Готово, коли: Playwright-тест форми зелений.
- [ ] **T9** manual (SC-027-01): page source екрана «Привіт» — чи є вузли бейджа, «+», таймера й
  кнопок оцінки; результат записати в «Припущення» spec.
- [x] **T10** Документація: spec → `Implemented`; глосарій — «Безіменний елемент», «Опора»,
  селектор `xpath:`; ADR-0021 → `Accepted`; `docs/architecture/api.md`.
- [ ] **T11** `/verify`: тести, типи, лінт, еталони скриншотів, `scripts/check-docs.py`, сценарії
  приймання.
