# 046 — Задачі

Одна зміна (рішення власника 2026-11-05), але задачі йдуть шарами: основи → оболонка →
екрани. `[P]` — не чіпає тих самих файлів, що сусідні.

- [x] **T1** (REQ-046-10, 11, 12, 14) Шкала в `theme.ts`: `type`, `radius`, типографіка,
  overrides `MuiLink`, `MuiChip`, таблиць; ESLint забороняє літерали поза шкалою.
  - Файли: `frontend/src/theme.ts`, `frontend/src/theme.test.ts`, `frontend/eslint.config.mjs`.
  - Готово, коли: `theme.test.ts` зелений, `npx eslint src` показує лише місця для T2.
- [x] **T2** (REQ-046-10, 11, 13, 15) Звести літерали шрифту й радіуса в `components/`, `pages/` до
  шкали; моноширинний лише для коду; один вигляд чипів.
  - Готово, коли: ESLint без помилок шкали; SC-046-02.
- [x] **T3** (REQ-046-20…27) `SideNav`, `AccountMenu`, `sideNav.helper`; прибрати `Header` і
  `NavRail` після входу; тур і Help-меню в бічне меню; вхід — мова й тема в куті.
  - Готово, коли: `sideNav.helper.test.ts`, `sideNav.spec.ts`, оновлені `theme.spec`, `language.spec`.
- [x] **T4** [P] (REQ-046-01…07) Порівняння: `fitScale`, `CompareToolbar`, `DiffMeter`,
  `StepProgress`, Size differs, Auto-next, згорнута порожня панель.
  - Готово, коли: `fit.helper.test.ts`, `StepProgress.test.tsx`, `compareLayout.spec.ts`.
- [x] **T5** [P] (REQ-046-40…43) Баг-діалог: підписи над полями, Create bug і прокрутка до
  поля, Draft again, назва поля Jira.
  - Готово, коли: нові тести в `reportBug.spec.ts`.
- [x] **T6** [P] (REQ-046-30, 31) Сітка без шапки, кнопка сортування, статус на мініатюрі;
  `TagOverflow` у таблиці.
  - Готово, коли: `testRunGrid.spec.ts`, `DeviceTags.test.tsx`.
- [x] **T7** [P] (REQ-046-32…35) Overview: нейтральні числа, підпис смужки, пристрій в рядок,
  No feature.
  - Готово, коли: нові тести в `buildOverview.spec.ts`.
- [x] **T8** [P] (REQ-046-50…55, 16, 17, 18) Login, Profile, Projects, Baselines, історія еталона;
  тексти All screens, New project, Selected/Previous.
  - Готово, коли: тести в `login`, `profile`, `projectList`, `testVariationList`,
    `testVariationDetails`, `language` spec.
- [x] **T9** ADR-0028 → Accepted; позначки «Замінено» в 018 (REQ-018-03, 32, 62, 65), 023
  (REQ-023-01), 041 (REQ-041-04); статус 046 → `Implemented`; DEMO.md, якщо там шапка.
- [ ] **T10** `/verify`: unit, tsc, eslint, Playwright функціонально, скриншот-еталони в Docker
  (переглянути кожен), `check-docs.py`, SC-046-01…04 вручну на 1280 і 1440 px обома мовами й темами.
