# 053 — Задачі

- [ ] **T1** (REQ-053-03, 06, 07, 20, 21) Чисті функції пошуку: `parseQuery` (текст або префікс,
  `component:`), `normalizeText`, `matchTree` на `findBySelector` і `componentOf`, `innermost`.
  - Файли: новий backend/src/ui-tree/screen-search.ts і screen-search.spec.ts.
  - Готово, коли: тести на фікстурах Android та iOS з `backend/src/ui-tree/__fixtures__` зелені,
    зокрема «той самий результат, що й правило з тим самим селектором» (SC-053-03).
- [ ] **T2** (REQ-053-02) Індекс у пам'яті ([ADR-0029](../../decisions/0029-screen-search-index-in-memory.md)):
  варіації головної гілки, довантаження за `baselineUiTreeName`, межа 8 проєктів, фонове збирання.
  - Файли: новий backend/src/ui-tree/screen-search.index.ts і його spec; `backend/src/ui-tree/ui-tree.module.ts`.
  - Готово, коли: тест «після нового еталона наступний пошук бачить нове дерево» і «викидає
    найдавніше використаний проєкт» зелені.
- [ ] **T3** (REQ-053-05, 09, 10, 22, 31, 40, 50, 52) Сервіс і маршрут `GET /projects/:id/screen-search`
  з `@ProjectFrom`; мініатюра з `Baseline.testRunId`; межі «У цій збірці».
  - Файли: новий backend/src/ui-tree/screen-search.service.ts і spec; `backend/src/projects/projects.controller.ts`.
  - Готово, коли: сервісні тести зелені, `project-access.routes.spec.ts` зелений, Swagger-тест бачить маршрут.
- [ ] **T4** [P] (REQ-053-01, 04, 30, 51) Сторінка пошуку, маршрут, пункт меню, клавіша `/`, тексти EN/UK.
  - Файли: нові frontend/src/pages/ScreenSearchPage.tsx (+ .test.tsx),
    frontend/src/components/ScreenSearch/SearchResultRow.tsx; `frontend/src/Router.jsx`,
    `frontend/src/constants/routes.ts`, `frontend/src/components/SideNav.tsx`,
    `frontend/src/services/projects.service.ts`, `frontend/src/i18n/en.ts`, `frontend/src/i18n/uk.ts`.
  - Готово, коли: vitest зелений; можна робити паралельно з T1–T3 на замоканому API.
- [ ] **T5** (REQ-053-08) Підсвітка знайдених елементів в еталоні за параметром `highlight`.
  - Файли: `frontend/src/components/TestVariationDetails.tsx`.
  - Готово, коли: Playwright-тест «opens the baseline with the found elements outlined» зелений.
- [ ] **T6** Playwright: frontend/integration_tests/test/screenSearch.spec.ts (меню, `/`, адреса,
  мініатюри, підсвітка); еталони скриншотів — у Docker ([ADR-0011](../../decisions/0011-screenshot-baselines-in-docker.md)).
- [ ] **T7** Документація: трасування з «план:» → `шлях › тест`; статус spec → `Implemented`;
  ADR-0029 → `Accepted` після рішення власника; огляд продукту (`docs/product/overview.md`), `DEMO.md`.
- [ ] **T8** manual: на копії проду заміряти перший і повторний пошук і пам'ять API (SC-053-01).
- [ ] **T9** `/verify`: тести, типи, лінт, еталони скриншотів, `scripts/check-docs.py`, сценарії приймання.
