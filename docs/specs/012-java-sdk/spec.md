# 012 — Java SDK з UI-деревом

- **Статус:** Implemented
- **Оновлено:** 2026-10-27
- **Пов'язане:** [ADR-0004](../../decisions/0004-sdk-upstream-plus-ui-tree.md), [DEPLOY.md §7–8](../../../DEPLOY.md)
- **Код:** `sdk-java/src/main/java/io/visual_regression_tracker/sdk_java/TestRunOptions.java`,
  `request/TestRunRequest.java`, збірка `scripts/build-sdk-jar.sh` → `dist/sdk-java/`

## Проблема

Автотести вже викликають `VisualRegressionTracker.track(...)` upstream SDK, а у `pom.xml` команд
прописана версія. Будь-яка зміна API SDK змусила б переписувати тести.

## Вимоги

| ID | Вимога |
|---|---|
| REQ-012-01 | SDK ПОВИНЕН відрізнятися від upstream 4.3.1 лише необов'язковим полем `TestRunOptions.uiTree` (XML page source). |
| REQ-012-02 | КОЛИ `uiTree` задано, SDK ПОВИНЕН надсилати його стиснутим (gzip + base64) у тому ж запиті `POST /test-runs`. |
| REQ-012-03 | КОЛИ `uiTree` не задано, SDK ПОВИНЕН надсилати запит, ідентичний upstream. |
| REQ-012-04 | Сервер без підтримки UI-дерева ПОВИНЕН приймати запит, ігноруючи поле. |
| REQ-012-05 | Jar ПОВИНЕН працювати на Java 11+ і підключатися до Maven-проєкту вручну (локальний репозиторій або jar у проєкті), без Nexus. |

## Трасування

| Вимога | Перевірка |
|---|---|
| 02 | `sdk-java/…/VisualRegressionTrackerTest.java › shouldSendTheUiTreeGzippedWhenGiven` |
| 03 | `› shouldLeaveTheUiTreeOutWhenNotGiven` |
| 01, 05 | manual: `git diff` проти upstream 4.3.1; підключення за DEPLOY.md §7 |
| 04 | дизайн: upstream `backend/src/main.ts` — `new ValidationPipe()` без `whitelist`, невідомі поля не відкидаються; manual: запит з `uiTree` на upstream VRT |
