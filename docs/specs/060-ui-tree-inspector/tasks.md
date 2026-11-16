# 060 — Задачі

- [ ] **T1** (REQ-060-06, 15, 16, 23, 30) Чисті функції `inspectorTree` і `nodeLocators`.
  - Файли: `backend/src/ui-tree/inspector-tree.ts`, `inspector-tree.spec.ts`.
  - Готово, коли: тести на Android, iOS і веб зелені.
- [ ] **T2** (REQ-060-08, 29, 37) Маршрути `GET /test-runs/:id/ui-tree` і `…/ui-tree/locators`.
  - Файли: `ui-tree.service.ts`, `test-runs.service.ts`, `test-runs.controller.ts`.
  - Готово, коли: `project-access.routes.spec.ts` зелений (маршрути позначені й відмовляють без доступу).
- [ ] **T3** [P] Типи й сервіс фронтенду (`types/insights.ts`, `services/insights.service.ts`).
- [ ] **T4** [P] (REQ-060-04, 05, 10, 11, 12, 17, 18, 21, 22, 25, 31, 33, 35) Хелпер
  `_helpers/treeInspector.helper.ts` з тестами.
- [ ] **T5** (REQ-060-01…03, 07…09, 15, 16, 19, 24, 26…28, 34) `ElementsTab`, `useInspectorTrees`,
  третя вкладка в `InsightsPanel`, тексти EN/UK; тести компонента.
- [ ] **T6** (REQ-060-10…14, 20, 26, 35) Діалог: рамки, клік і наведення на знімку, дії з дерева,
  `panel=elements&node=` з адреси.
- [ ] **T7** (REQ-060-31…37) `InspectorPage` і маршрут.
- [ ] **T8** Документація: статус spec → `Implemented`, `frontend/AGENTS.md`, `backend/AGENTS.md`,
  `docs/architecture/api.md`.
- [ ] **T9** `/verify`.
