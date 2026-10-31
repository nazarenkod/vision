# 031 — Задачі

- [x] **T1** (REQ-031-04, REQ-031-60…69) Міграція: таблиця `ReportLink`, `TestRun.decidedById`;
  `decision-undo.service.ts` пише автора рішення, Undo стирає.
  - Файли: `backend/prisma/schema.prisma`, нова міграція, `backend/src/test-runs/decision-undo.service.ts`.
  - Готово, коли: `npx prisma generate`, `decision-undo.spec.ts` зелений, міграція лише додає.
- [x] **T2** (REQ-031-03…05, 08…12) Чиста `buildOverview` з тестами.
  - Файли: backend/src/builds/build-overview.ts, build-overview.spec.ts.
  - Готово, коли: тести з «Перевірки вимог» для цих REQ зелені.
- [x] **T3** (REQ-031-10, 48) Сервіс і маршрут `GET /builds/:id/overview`; баги доступності збірки з кешем.
  - Файли: build-overview.service.ts, `backend/src/builds/builds.controller.ts`,
    `backend/src/a11y/a11y-issues.service.ts`.
  - Готово, коли: сервісний тест з моками Prisma зелений; 500 прогонів — ≤ 2 с на копії даних.
- [x] **T4** [P] (REQ-031-20…23, 27) Чистий `reviewQueue` з тестами.
  - Файли: frontend/src/_helpers/reviewQueue.helper.ts, .test.ts.
- [x] **T5** [P] (REQ-031-45, 47) Чистий `reportText` з тестами.
  - Файли: frontend/src/_helpers/reportText.helper.ts, .test.ts.
- [x] **T6** (REQ-031-01, 02, 05…13) Вкладка Overview: типи, сервіс, `BuildOverview/`, `tab` в адресі,
  оновлення з сокета; тексти EN/UK.
  - Файли: `frontend/src/pages/ProjectPage.tsx`, `frontend/src/_helpers/route.helpers.ts`,
    frontend/src/components/BuildOverview/, `frontend/src/i18n/en.ts`, `frontend/src/i18n/uk.ts`.
  - Готово, коли: buildOverview.spec.ts (Playwright) зелений.
- [x] **T7** (REQ-031-20…29) Черга в порівнянні: `queue` в адресі, `QueueHeader`, `QueueDone`,
  повернення й фокус. Після T4 і T6.
  - Файли: `frontend/src/components/TestDetailsDialog/index.tsx`, QueueHeader.tsx, QueueDone.tsx.
  - Готово, коли: сценарії US-2 у buildOverview.spec.ts зелені; без `queue` крокування як було.
- [x] **T8** (REQ-031-60…69) Модуль `reports`: посилання, публічний ендпоінт з `ETag`, білий список
  полів, ролі.
  - Файли: backend/src/reports/.
  - Готово, коли: report-links.spec.ts і reports.controller.spec.ts зелені.
- [x] **T9** (REQ-031-40…47) Діалог звіту й `ReportDocument`, друк A4. Після T5, T6, T8.
  - Файли: frontend/src/components/BuildReport/.
  - Готово, коли: ReportDocument.test.tsx і buildReport.spec.ts зелені; PDF перевірено вручну.
- [x] **T10** (REQ-031-62…65) Публічна сторінка `/r/:token` поза входом, перепит кожні 8 с. Після T8, T9.
  - Файли: frontend/src/pages/PublicReportPage.tsx, `frontend/src/Router.jsx`.
  - Готово, коли: publicReport.spec.ts зелений.
- [x] **T11** Документація: у [018](../018-ui-redesign/spec.md) REQ-018-32 позначка «Замінено частково
  [031] REQ-031-24»; трасування в design.md стає `шлях › назва`; таблиці модулів у
  `backend/AGENTS.md` і `frontend/AGENTS.md`; `DEMO.md`; статус → `Implemented`; ADR-0022 → `Accepted`.
- [x] **T12** `/verify`: тести, типи, лінт, еталони скриншотів (Docker), `scripts/check-docs.py`,
  сценарії приймання на копії даних.
