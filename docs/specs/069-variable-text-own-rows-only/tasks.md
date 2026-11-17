# 069 — Задачі

- [ ] **T1** (REQ-069-01, 02, 05) `fitsSkeleton` у `variable-text.ts`, `variableNodes` і його
  використання в `resolveRules` для `leftOut`, `quietKeys`, `found`, `matches`.
  - Файли: `backend/src/ui-tree/variable-text.ts`, `backend/src/ui-tree/comparison-inputs.ts`,
    `backend/src/ui-tree/comparison-inputs.spec.ts`.
  - Готово, коли: тести REQ-069-01, 02, 05 зелені на рядках історії з різною незмінною частиною.
- [ ] **T2** (REQ-069-03) Перевірка вузлів за id, коли не відібрано жодного, а в еталоні був.
  - Файли: `backend/src/ui-tree/comparison-inputs.ts`, `comparison-inputs.spec.ts`.
  - Готово, коли: тест REQ-069-03 зелений; `gone` лишається для випадку без вузлів за id.
- [ ] **T3** [P] (REQ-069-04) `fitsSkeleton`, `variableCount` у `variableText.helper.ts`; `countFor`
  отримує шматки.
  - Файли: `frontend/src/_helpers/variableText.helper.ts`, `variableText.helper.test.ts`,
    `frontend/src/components/TestDetailsDialog/TestDetailsModal.tsx`, `ElementPopover.tsx`.
  - Готово, коли: тест REQ-069-04 зелений, типи фронтенду проходять.
- [ ] **T4** Документація: статус spec → `Implemented`; у 033 біля REQ-033-18, 20, 25, 29 —
  «Замінено частково 2026-11-17 [069]…»; рядок у `docs/specs/README.md`.
- [ ] **T5** `/verify`.
