# 071 — Задачі

- [x] **T1** (REQ-071-02) `placesOf` у `variable-text.ts`; `textMask`, `placeAreas` у `text-locate.ts`.
  - Файли: `backend/src/ui-tree/variable-text.ts`, `backend/src/ui-tree/text-locate.ts`, `text-locate.spec.ts`.
  - Готово, коли: тест REQ-071-02 зелений на словах рядків історії (повтор «11», «*1050», «17 серпня»).
- [x] **T2** (REQ-071-01, 03…05) `locateCandidates`, `resolveRules(…, located)`, нові причини `LeftOut`.
  - Файли: `backend/src/ui-tree/comparison-inputs.ts`, `comparison-inputs.spec.ts`.
  - Готово, коли: тести REQ-071-01, 03, 04, 05 зелені; тести 033, 066, 070 не змінились.
- [x] **T3** (REQ-071-06…08) `TextLocatorService`: `tesseract.js` і моделі з точними версіями, черга, 5 с, 20 елементів, кеш; фікстура — намальований рядок, не знімок банку.
  - Файли: `backend/package.json`, `package-lock.json`, `backend/src/ui-tree/text-locator.service.ts`, `text-locator.service.spec.ts`, `__fixtures__/`.
  - Готово, коли: тести REQ-071-06…08 зелені без мережі.
- [x] **T4** `comparisonInputs`: два проходи, знімки через `StaticService`; модуль Nest.
  - Файли: `backend/src/ui-tree/ui-tree.service.ts`, `ui-tree.module.ts`, наявні тести сервісу.
- [x] **T5** [P] (REQ-071-09…11) Фронтенд: типи, поповер, словники EN/UK, схема.
  - Файли: `frontend/src/types/insights.ts`, `ElementPopover.tsx`, `i18n/en.ts`, `uk.ts`, хелпери й тести.
- [x] **T6** Документація: статус → `Implemented`; у 066 «Замінено частково» біля REQ-066-03, 05, 06, 07; ADR-0031 → `Accepted` у переліку; `backend/AGENTS.md`; `NOTICE` — `tesseract.js` і моделі; `DEPLOY.md` — пам'ять API.
- [x] **T7** `/verify`. Ручна перевірка на оригіналах 1440×3040 (SC-071-01…03) — після розгортання; на стиснених знімках історії 2026-11-17 знайдено 18 з 18 місць.
