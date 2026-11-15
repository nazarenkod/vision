# 050 — Задачі

- [x] **T1** (REQ-050-21, 24, 14, 13, 08) Скрипт збору `web-tree/collect-tree.js` і фікстури,
  зібрані ним у Chromium.
  - Готово, коли: скрипт на фікстурних сторінках дає HTML з `data-vision-*`.
- [x] **T2** (REQ-050-01…04, 08, 09, 13, 14, 47) Прийом і розбір вебу: `web-tree.parser.ts`,
  `detectFormat`, DOCTYPE HTML у `readUiTreeXml`, `uiTreeFormat: web`.
  - Готово, коли: `web-tree.parser.spec.ts`, `ui-tree.intake.spec.ts` зелені.
- [x] **T3** (REQ-050-05…07) Порівняння вебу: системні смуги, правила елементів, зсуви.
  - Готово, коли: `web-tree.compare.spec.ts` зелений.
- [x] **T4** (REQ-050-09…12) Доступність вебу: поля вводу, контраст, `touchTargetWeb`, без
  координат.
  - Готово, коли: `a11y.web.spec.ts`, `a11y-norms.spec.ts` зелені.
- [x] **T5** (REQ-050-40, 41, 45, 51…53) Платформа й браузери на бекенді: `uiTreeSettings`,
  `allowed-browsers.ts`, `browserVersion` (міграція), `GET /projects/:id/browsers`.
  - Готово, коли: `allowed-browsers.spec.ts`, `comparison-inputs.spec.ts`, `projects.service.spec.ts` зелені.
- [x] **T6** [P] (REQ-050-30, 42…46, 48…50, 12, 09) Фронтенд: вибір платформи, приховані поля,
  норма вебу, перелік браузерів, пояснення без координат; тексти EN/UK.
  - Готово, коли: `projectSettings.helper.test.ts`, `allowedBrowsers.helper.test.ts`, Playwright-тест налаштувань зелені.
- [x] **T7** [P] (REQ-050-20, 22) Java SDK: `WebUiTree.collect`, `VisionOptions.browserVersion`.
  - Готово, коли: `gradle test` зелений.
- [x] **T8** [P] (REQ-050-21…25) `sdk-playwright/`: порт `agent-playwright`, збір дерева.
  - Готово, коли: тести `sdk-playwright` зелені в Chromium.
- [x] **T9** Документація: статус spec → `Implemented`, NOTICE, AGENTS.md пакетів, DEPLOY.md (SDK
  для Playwright), «Перевірка вимог».
- [x] **T10** `/verify`.

Лишилось: еталон скриншота
`projectSettings.spec.ts › renders in Ukrainian` (нове поле «Платформа») — перегенерувати в Docker.
