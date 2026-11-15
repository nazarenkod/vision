# 055 — Задачі

Залежить від [054](../054-rules-from-noise-history/tasks.md) T1 (`TestRun.changeFacts`) — лише
US-6 (плитки); решта незалежна. Синтаксис запиту спільний із [053](../053-screen-search/tasks.md) T1:
`parseChangeQuery` використовує `parseQuery` з 053, тож 053 T1 — першою.

- [ ] **T1** Винести `effectiveChanges(run)` зі `UiTreeService.structure` без зміни поведінки.
  - Файли: `backend/src/ui-tree/ui-tree.service.ts`.
  - Готово, коли: наявні `ui-tree.service.spec.ts` і `structure.characterization.spec.ts` зелені без змін.
- [ ] **T2** (REQ-055-01, 03, 04, 40, 41) Чисті `parseChangeQuery` і `matchRun`.
  - Файли: нові backend/src/test-runs/change-query.ts і spec.
  - Готово, коли: тести на фікстурах «лише заголовок», «заголовок і ще щось», «елемент зник»,
    «зсув усього під тулбаром», «лише пікселі» зелені.
- [ ] **T3** (REQ-055-02, 05, 06, 22, 24, 25) Сервіс і маршрути `GET /test-runs/query`,
  `POST /test-runs/query/decide`, DTO.
  - Файли: новий backend/src/test-runs/change-query.service.ts і spec; `backend/src/test-runs/test-runs.controller.ts`.
  - Готово, коли: сервісні тести, `project-access.routes.spec.ts`, `strip-unknown-fields.pipe.spec.ts`
    і тест Undo через справжній журнал зелені.
- [ ] **T4** (REQ-055-10…12, 20, 21, 23, 50, 51) Панель «Рішення за запитом» на сторінці збірки.
  - Файли: новий frontend/src/components/BuildQuery/ChangeQueryPanel.tsx (+ test);
    `frontend/src/pages/ProjectPage.tsx`, `frontend/src/services/testRun.service.ts`, `frontend/src/i18n/en.ts`, `frontend/src/i18n/uk.ts`.
- [ ] **T5** [P] (REQ-055-30) Пункт меню рядка зміни.
  - Файли: `frontend/src/components/TestDetailsDialog/InsightsPanel.tsx`.
- [ ] **T6** [P] (REQ-055-60) Рух зі знаком і напрямом.
  - Файли: `backend/src/ui-tree/structure-diff.ts`, `frontend/src/components/TestDetailsDialog/changedAreas.ts` і їхні тести; ключі `changes.moved*`.
- [ ] **T7** (REQ-055-61, 62) Рядки змін на плитці (після 054 T1).
  - Файли: backend/src/ui-tree/change-facts.ts (коротке «було → стало»), `frontend/src/components/TestRunList/TestRunGrid.tsx`.
  - Готово, коли: еталони скриншотів `testRunGrid.spec.ts` оновлено в Docker ([ADR-0011](../../decisions/0011-screenshot-baselines-in-docker.md)).
- [ ] **T8** Playwright: frontend/integration_tests/test/changeQuery.spec.ts.
- [ ] **T9** Документація: трасування «план:» → `шлях › тест`; spec → `Implemented`; `DEMO.md`.
- [ ] **T10** manual: SC-055-03 — збірка на 500 екранів на копії проду.
- [ ] **T11** `/verify`.
