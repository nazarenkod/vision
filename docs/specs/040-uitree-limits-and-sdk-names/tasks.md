# 040 — Задачі

- [x] **T1** (REQ-040-01…03) Чиста функція прийому дерева.
  - Файли: `backend/src/ui-tree/ui-tree.intake.ts`, `ui-tree.intake.spec.ts`.
  - Готово, коли: тести меж, gzip-бомби й `DOCTYPE` зелені.
- [x] **T2** (REQ-040-04, 06) `store` через `readUiTreeXml`, назва перевірки й проєкт у лозі;
  `fast-xml-parser` 5.12 у власних `node_modules`.
  - Файли: `ui-tree.service.ts`, `test-runs.service.ts`, `package.json`, `package-lock.json`.
  - Готово, коли: усі тести `ui-tree` і `test-runs` зелені, `npm audit` без парсера.
- [x] **T3** [P] (REQ-040-07…12) SDK: пакет `ua.vision.sdk`, `VISION_*`, `vision.json`, лог
  «Vision», ліміт дерева, `ua.vision:vision-sdk:1.0.0`.
  - Файли: `sdk-java/**`, `scripts/build-sdk-jar.sh`, `scripts/tests/test_build_sdk_jar.py`.
  - Готово, коли: `gradle test` зелений.
- [x] **T4** (REQ-040-05, 13) Контрольний сценарій: новий пакет SDK, крок із ворожими деревами;
  решта еталона без змін.
- [x] **T5** jar у `dist/sdk-java/`, `dist/sdk-java/README.md`, `sdk-java/AGENTS.md`, `AGENTS.md`
  (правило 5), `DEPLOY.md`, ADR-0026, позначки «Замінено» в 012 і 033; статус → `Implemented`.
- [x] **T6** `/verify`, `gradle test`, контрольний сценарій.
