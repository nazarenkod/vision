# 065 — Задачі

- [x] **T1** (REQ-065-03…06) `listedProblemsOf` — проблеми переглянутого звіту рядками.
  - Файли: `backend/src/a11y/a11y-issues.ts`, `a11y-issues.spec.ts`.
  - Готово, коли: тест `lists one line per problem…` зелений.
- [x] **T2** (REQ-065-01) `GET /builds/:id/a11y-problems`: `problemListsOn`, `BuildOverviewService.a11yProblems`.
  - Файли: `backend/src/a11y/a11y-issues.service.ts`, `backend/src/builds/build-overview.service.ts`,
    `builds.controller.ts`, `build-overview.service.spec.ts`.
  - Готово, коли: `project-access.routes.spec.ts` і тест сервісу зелені.
- [x] **T3** (REQ-065-01, 02, 07) Список під рядком знімка на вкладці «Доступність».
  - Файли: `frontend/src/components/A11ySummary.tsx`, `types/buildOverview.ts`,
    `services/buildOverview.service.ts`.
  - Готово, коли: `buildOverview.spec.ts › lists every accessibility problem…` зелений.
- [x] **T4** (REQ-065-08) `issue` в адресі й вибір знахідки в порівнянні.
  - Файли: `frontend/src/_helpers/route.helpers.ts`, `TestDetailsModal.tsx`, `InsightsPanel.tsx`.
  - Готово, коли: тести `opens the review with the problem chosen…` і `opens a screen with the problem chosen…` зелені.
- [x] **T5** Документація: статус → `Implemented`, позначка в [031](../031-build-overview/spec.md)
  REQ-031-71, маршрут у `docs/architecture/api.md`.
- [x] **T6** `/verify`.
