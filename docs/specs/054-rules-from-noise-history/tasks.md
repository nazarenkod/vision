# 054 — Задачі

- [ ] **T1** (REQ-054-03, 04) Факти змін: чиста `changeFacts`, міграція колонки `TestRun.changeFacts`,
  запис в `analyze` і `recheck`. Ця задача потрібна й 055 (рядки змін на плитках).
  - Файли: нові backend/src/ui-tree/change-facts.ts і spec; `backend/prisma/schema.prisma`,
    нова міграція в `backend/prisma/migrations/`; `backend/src/ui-tree/ui-tree.service.ts`.
  - Готово, коли: тести фактів зелені; `npx prisma generate`; перевірка міграцій у `verify.py` зелена.
- [ ] **T2** (REQ-054-01, 02, 08, 10) Чиста `noisyElements` і `mergeWithHints`.
  - Файли: нові backend/src/test-runs/noise-history.ts і spec.
  - Готово, коли: тести на історіях «5 з 10 прийнято», «одне відхилено», «баг», «банер то є, то немає» зелені.
- [ ] **T3** (REQ-054-05, 09, 30, 40, 41) Сервіс шуму, таблиця `NoiseDismissal`, поле `noise` у
  `structure`, маршрут `POST /test-runs/:id/noise/dismiss`.
  - Файли: новий backend/src/test-runs/noise-history.service.ts і spec; `backend/src/ui-tree/ui-tree.service.ts`;
    `backend/src/test-runs/test-runs.controller.ts`; DTO з class-validator.
  - Готово, коли: сервісні тести зелені, `project-access.routes.spec.ts` і `strip-unknown-fields.pipe.spec.ts` зелені.
- [ ] **T4** [P] (REQ-054-20, 22) `historyParts(texts)` у `frontend/src/_helpers/variableText.helper.ts`.
  - Готово, коли: vitest зелений.
- [ ] **T5** (REQ-054-06, 07, 21, 31, 60) Рядок зміни: факт з історії, «Ігнорувати тут», «на всіх
  екранах» з підтвердженням, «Нестабільний текст» з позначеними шматками, «Не пропонувати»; тексти EN/UK.
  - Файли: `frontend/src/components/TestDetailsDialog/InsightsPanel.tsx`, `frontend/src/i18n/en.ts`, `frontend/src/i18n/uk.ts`.
- [ ] **T6** [P] (REQ-054-50) Блок «Шумні елементи» в Insights.
  - Файли: `backend/src/analytics/insights.ts`, `backend/src/analytics/analytics.service.ts`, `frontend/src/pages/InsightsPage.tsx`.
- [ ] **T7** Playwright: frontend/integration_tests/test/noiseHistory.spec.ts (історія на фікстурі з 10 прогонами).
- [ ] **T8** Документація: трасування з «план:» → `шлях › тест`; spec → `Implemented`;
  у [006](../006-change-groups/spec.md) нічого не змінюється (розширення, не заміна); `DEMO.md`.
- [ ] **T9** manual: SC-054-03 — час `structure` до й після на копії проду.
- [ ] **T10** `/verify`.
