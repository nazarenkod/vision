# 070 — Задачі

- [x] **T1** (REQ-070-01, 02, 05) `fitsSkeleton` у `variable-text.ts`, `ruleNodes` і його
  використання в `resolveRules` для `leftOut`, `quietKeys`, `found`, `matches`.
  - Файли: `backend/src/ui-tree/variable-text.ts`, `backend/src/ui-tree/comparison-inputs.ts`,
    `backend/src/ui-tree/comparison-inputs.spec.ts`.
  - Готово, коли: тести REQ-070-01, 02, 05 зелені на рядках історії з різною незмінною частиною.
- [x] **T2** (REQ-070-03) Перевірка вузлів за id, коли не відібрано жодного, а в еталоні був.
  - Файли: `backend/src/ui-tree/comparison-inputs.ts`, `comparison-inputs.spec.ts`.
  - Готово, коли: тест REQ-070-03 зелений; `gone` лишається для випадку без вузлів за id.
- [x] **T3** [P] (REQ-070-04) `fitsSkeleton`, `variableCount` у `variableText.helper.ts`; `countFor`
  отримує шматки.
  - Файли: `frontend/src/_helpers/variableText.helper.ts`, `variableText.helper.test.ts`,
    `frontend/src/components/TestDetailsDialog/TestDetailsModal.tsx`, `ElementPopover.tsx`.
  - Готово, коли: тест REQ-070-04 зелений, типи фронтенду проходять.
- [x] **T4** Документація: статус spec → `Implemented`; у 033 біля REQ-033-18, 20, 25, 29 —
  «Замінено частково 2026-11-17 [070]…»; рядок у `docs/specs/README.md`.
- [x] **T5** `/verify`.
