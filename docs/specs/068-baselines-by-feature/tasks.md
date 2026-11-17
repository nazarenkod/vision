# 068 — Задачі

- [x] **T1** (REQ-068-01, 02, 03) Колонка `TestVariation.featureName`, міграція з заповненням, `prisma generate`, DTO.
  - Файли: `backend/prisma/schema.prisma`, міграція, `backend/src/test-variations/dto/base-test-variation.dto.ts`.
  - Готово, коли: `npx tsc --noEmit` чистий.
- [x] **T2** (REQ-068-01, 02, 12) `featureToKeep` і запис у `postTestRun`, `create`, `approve` без зсуву `updatedAt`.
  - Готово, коли: `variation-feature.spec.ts` і новий тест у `test-runs.service.spec.ts` зелені.
- [x] **T3** [P] (REQ-068-04…08, 11, 13) `baselineSections.helper.ts` з тестами.
- [x] **T4** (REQ-068-09, 10) Рамки фіч у `TestVariationList`, фільтр «Фіча» в `Filters`, сторінка — за секціями; словники.
  - Готово, коли: `TestVariationList.test.tsx` зелений.
- [ ] **T5** Документація: статус spec → `Implemented` (після T6), словник (`featureName`) — зроблено.
- [ ] **T6** `/verify`: тести, типи, лінт, еталони скриншотів, `scripts/check-docs.py`.
