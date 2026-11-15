# 053 — Задачі

- [x] **T1** (REQ-053-03, 06, 07, 20, 21) Чисті функції пошуку: `parseQuery`, `normalizeText`,
  `matchTree`, `innermost` — `backend/src/ui-tree/screen-search.ts`.
- [x] **T2** (REQ-053-02) Індекс у пам'яті — `backend/src/ui-tree/screen-search.index.ts`.
- [x] **T3** (REQ-053-05, 09, 10, 22, 31, 40, 50, 52) Сервіс і маршрут `GET /projects/:id/screen-search`.
- [x] **T4** (REQ-053-01, 04, 30, 51) Сторінка пошуку, маршрут, пункт меню, клавіша `/`, тексти EN/UK.
- [x] **T5** (REQ-053-08) Підсвітка знайдених елементів в еталоні.
- [x] **T6** Playwright: `frontend/integration_tests/test/screenSearch.spec.ts`.
- [x] **T7** Документація: трасування, статус `Implemented`, огляд продукту.
- [ ] **T8** manual: на копії проду заміряти перший і повторний пошук і пам'ять API (SC-053-01);
  після цього — рішення власника щодо [ADR-0029](../../decisions/0029-screen-search-index-in-memory.md).
- [ ] **T9** Еталони скриншотів із бічним меню (новий пункт «Пошук») — оновити в Docker
  ([ADR-0011](../../decisions/0011-screenshot-baselines-in-docker.md)).
