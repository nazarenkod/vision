# 057 — Задачі

- [x] **T1** (REQ-057-02, -04, -10, -11, -12, -13) Хелпер меню: групи `project` і `admin`, без
  `projects` і `search`; `projectTileLabel`, `railProjects`; тести на кожну функцію.
  - Файли: `frontend/src/_helpers/sideNav.helper.ts`, `sideNav.helper.test.ts`.
  - Готово, коли: `CI=true npx jest sideNav.helper` зелений.
- [x] **T2** (REQ-057-01, -03, -05, -06, -07) `ProjectRail`: логотип → Projects, плитки з
  підказками й `aria-current`, «+» для admin/editor, прокрутка лише плиток, аватар.
  - Файли: `frontend/src/components/ProjectRail.tsx`, `SideNav.locators.ts`, `i18n/en.ts`, `uk.ts`.
  - Готово, коли: тести рейки в `sideNav.spec.ts` зелені.
- [x] **T3** (REQ-057-10…15, -40, -41) `SectionPanel` і новий `SideNav`: рейка + панель, переїзд
  позначки, тихе виділення; `ProjectSelect` без варіанта `sidebar`.
  - Файли: `SectionPanel.tsx`, `SideNav.tsx`, `ProjectSelect.tsx`.
  - Готово, коли: тести панелі в `sideNav.spec.ts` зелені, `tsc` без нових помилок.
- [x] **T4** (REQ-057-30) Вузьке вікно: лише рейка з іконками розділів і адмін-пунктів.
  - Файли: `SideNav.tsx`, `ProjectRail.tsx`.
  - Готово, коли: `keeps only the rail with section icons below 1100 px` зелений.
- [x] **T5** [P] (REQ-057-20) Меню акаунта: «Усі проєкти», тур, ручні перевірки, «Повідомити
  про проблему», версія; кроки туру — на рейку.
  - Файли: `AccountMenu.tsx`, `GuidedTour.tsx`, `i18n/*`.
  - Готово, коли: `holds all projects, help and the version in the account menu` і тест туру зелені.
- [x] **T6** [P] (REQ-057-50, -51) Прибрати пошук з фронтенду: сторінка, палітра, клавіша `/`,
  хелпер, тип, методи сервісу, рамки `?highlight`, ключі словників, `screenSearch.spec.ts`;
  `/search/:projectId` → Збірки.
  - Готово, коли: два тести пошуку в `sideNav.spec.ts` зелені, `grep -r screenSearch src` порожній.
- [x] **T7** Документація: статус spec → `Implemented`; позначки «Замінено 2026-…» у REQ-046-20,
  -22, -23, -24, -25, -27 і «Знято 2026-… [057]» у вимогах 053; `docs/product/overview.md`,
  `docs/architecture/api.md` (пошук лише через API), `frontend/AGENTS.md`.
- [ ] **T8** Скриншот-еталони: `./test-docker.sh --update-snapshots`, переглянути кожен змінений.
  Не зроблено: у хмарній сесії 2026-11-16 немає Docker-демона.
- [ ] **T9** `/verify`: тести, типи, лінт, еталони скриншотів, `scripts/check-docs.py`, сценарії
  приймання (обидві теми, обидві мови, 1280 і 1024 px).
  Частково 2026-11-16: unit-тести фронтенду (295), `tsc` проти базової лінії, eslint, `check-docs.py`,
  Playwright без скриншотів — 398 з 399; впав `buildOverview.spec.ts › groups the checks of a feature
  under it…`, який так само падає на `main`. Не запущено: тести бекенду (потрібен Node 24, тут 22;
  бекенд не змінювався) і скриншот-еталони (T8).
