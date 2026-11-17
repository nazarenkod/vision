# 065 — Задачі

- [x] **T1** (REQ-065-01…03) `textParts`, `leftOut`, `quietKeys` у `resolveRules`; `ignore` з
  `leftOut`; `variableTextAreas` з ключами.
  - Файли: `backend/src/ui-tree/comparison-inputs.ts`, `comparison-inputs.spec.ts`.
  - Готово, коли: тести REQ-065-01…03 зелені, старі тести 033 — без змін.
- [x] **T2** (REQ-065-04) Фільтр змін за ключами: `outsideAreas`, `comparisonInputs`,
  `structure` (+`leftOut` у правилі, `labelOnly` у елементі), групи змін.
  - Файли: `backend/src/ui-tree/ui-tree.service.ts`, `ui-tree.service.spec.ts`,
    `backend/src/test-runs/change-groups.service.ts`.
  - Готово, коли: тест REQ-065-04 зелений.
- [x] **T3** (REQ-065-05, 07, 10) Типи й чисті функції фронтенду: `leftOutFor`, `leftOutMarks`,
  `wordsOnly`, `textOnScreen`; схема знімка.
  - Файли: `frontend/src/types/insights.ts`, `_helpers/variableText.helper.ts`,
    `_helpers/whatsCompared.helper.ts` і їхні тести.
- [x] **T4** (REQ-065-05, 06, 08, 09, 11, 12) Позначки, поповер, перехід на вкладений текст,
  тексти EN/UK.
  - Файли: `TestDetailsModal.tsx`, `ElementPopover.tsx`, `ElementPopover.test.tsx`,
    `i18n/en.ts`, `i18n/uk.ts`.
- [x] **T5** Документація: статус spec → `Implemented`; у 033 позначки «Замінено» в REQ-033-15,
  REQ-033-30 і пункті «Поза межами»; `backend/AGENTS.md`, якщо треба.
- [ ] **T6** `/verify`.
