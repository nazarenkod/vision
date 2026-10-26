# 008 — Дизайн

## Підхід

Сервіс за один раз вибирає прогони вікна (до 200 тис.), лічильники еталонів і рішення щодо
доступності й передає їх чистій функції `computeInsights`, яка повертає всі розділи. Звіти
доступності читаються з файлів для останнього прогону кожної перевірки.

## Компоненти

| Компонент | Шлях | Роль |
|---|---|---|
| Розрахунок | `backend/src/analytics/insights.ts` | `computeInsights`, `deviceOf` |
| Дані | `backend/src/analytics/analytics.service.ts` | `projectInsights`; `MAX_RUNS` |
| API | `backend/src/analytics/analytics.controller.ts` | `GET /analytics/:projectId?days=` (7–730, типово 90) |
| UI | `frontend/src/pages/InsightsPage.tsx` | `PERIODS` 30/90/180/365, масове видалення еталонів |

## Перевірка вимог

| Вимога | Перевірка |
|---|---|
| REQ-008-01 | `frontend/integration_tests/test/insights.spec.ts › asks for the period it shows` |
| REQ-008-02 | `backend/src/analytics/insights.spec.ts › suggests deleting baselines nothing was compared with during the window` |
| REQ-008-09 | `frontend/integration_tests/test/insights.spec.ts › deletes the selected unused baselines after confirming` |
| REQ-008-03 | `backend/src/analytics/insights.spec.ts › ranks unstable screens: flips first, then how often they change` |
| REQ-008-10 | `backend/src/analytics/insights.spec.ts › does not call a change a flip when the baseline changed in between` |
| REQ-008-05 | `backend/src/analytics/insights.spec.ts › points at noise, early screenshots and hidden changes` |
| REQ-008-04 | `backend/src/analytics/insights.spec.ts › ranks screens by their newest accessibility issues, with the decisions taken on them` |
| REQ-008-06 | `backend/src/analytics/insights.spec.ts › lists the checks each device is missing on the main branch` |
| REQ-008-07 | `backend/src/analytics/insights.spec.ts › counts reviews waiting for a decision by the newest run of each baseline` |
| REQ-008-08 | `backend/src/analytics/insights.spec.ts › judges only the history that is left when older builds were removed` |
