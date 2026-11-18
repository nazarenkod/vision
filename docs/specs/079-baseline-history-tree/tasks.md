# 079 — Задачі

- [x] **T1** (REQ-079-06, 23) Бекенд: `UiTreeService.inspectorOf(name)`,
  `TestVariationsService.getBaselineUiTree`, маршрут
  `GET /test-variations/:id/baselines/:baselineId/ui-tree`, імпорт `UiTreeModule`.
  - Файли: `backend/src/ui-tree/ui-tree.service.ts`, `backend/src/test-variations/*`.
  - Готово, коли: `test-variations.service.spec.ts` (чужа версія → 404, без дерева → `null`,
    з деревом → вузли) і `project-access.routes.spec.ts` зелені.
- [x] **T2** [P] (REQ-079-10, 14, 15, 18) Хелпер `baselineTrees.helper.ts`: `counterpart`,
  `pairCard`, `pairOutlines`, `baselineTreesLocation`, `historyLocation`, `readHistoryPlace`.
  - Готово, коли: `baselineTrees.helper.test.ts` зелений.
- [x] **T3** [P] (REQ-079-03, 04, 21) `ElementsTab viewOnly`: без перемикача боку, чипів змін і
  доступності, переходу між змінами, копіювання й власної картки; тест, що без позначок
  розгортаються два рівні.
  - Готово, коли: `ElementsTab.test.tsx` і `treeInspector.helper.test.ts` зелені, наявні тести
    вкладки не змінились.
- [x] **T4** [P] Винести `TreeScreen` з `InspectorPage` без зміни поведінки.
  - Готово, коли: `elementsTab.spec.ts` зелений.
- [x] **T5** (REQ-079-05, 07) Тип `Baseline.uiTreeName`, `testVariationService.getBaselineUiTree`,
  хук `useBaselineTrees`. Залежить від T1 (форма відповіді).
  - Готово, коли: `useBaselineTrees.test.tsx` зелений.
- [x] **T6** (REQ-079-06…08, 11…16) `BaselineTreePair` і `PairNodeCard`: два знімки з рамками, два
  дерева, спільний вибір і наведення за ключем, картка двома колонками, стани без дерева,
  помилки, першої версії. Залежить від T2–T5.
  - Готово, коли: `BaselineTreePair.test.tsx` зелений.
- [x] **T7** (REQ-079-01, 02, 09, 20, 22) Історія еталона: перемикач «Знімки / Знімки й дерево»,
  пара з деревами, `baseline`/`view`/`node` в адресі, вузька ширина, словник EN/UK.
- [x] **T8** (REQ-079-17…19) `BaselineTreesPage` на весь екран, маршрут, Esc і «Назад».
- [x] **T9** Playwright `baselineHistoryTree.spec.ts` з моками API (REQ-079-01, 02, 09, 12, 17,
  19); скриншот-еталон історії в режимі «Знімки» лишається тим самим (SC-079-03).
- [x] **T10** Документація: статус spec → `Implemented`, «Перевірка вимог» звірена з тестами,
  `docs/architecture/api.md` — новий маршрут, `frontend/AGENTS.md` — `BaselineTrees/`, рядок у
  `docs/specs/README.md`.
- [x] **T11** `/verify`: тести, типи, лінт, еталони скриншотів, `scripts/check-docs.py`, сценарії
  приймання.
