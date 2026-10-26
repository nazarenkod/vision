# 012 — Дизайн

## Підхід

`TestRunOptions.uiTree` (рядок XML). `TestRunRequest` перед надсиланням стискає його
gzip + base64 у поле `uiTree`. Розбір, формат і щільність визначає сервер. Upstream сервер
використовує `new ValidationPipe()` без `whitelist`, тож невідоме поле не відкидається.

## Компоненти

| Компонент | Шлях | Роль |
|---|---|---|
| Параметр | `sdk-java/src/main/java/io/visual_regression_tracker/sdk_java/TestRunOptions.java` | `uiTree` |
| Запит | `sdk-java/src/main/java/io/visual_regression_tracker/sdk_java/request/TestRunRequest.java` | стиснення |
| Збірка | `scripts/build-sdk-jar.sh` | jar і pom → `dist/sdk-java/` (`4.3.1-vision.N`) |

## Перевірка вимог

| Вимога | Перевірка |
|---|---|
| REQ-012-01 | manual: `git diff` `sdk-java/` проти upstream 4.3.1 |
| REQ-012-02 | `sdk-java/src/test/java/io/visual_regression_tracker/sdk_java/VisualRegressionTrackerTest.java › shouldSendTheUiTreeGzippedWhenGiven` |
| REQ-012-03 | `sdk-java/src/test/java/io/visual_regression_tracker/sdk_java/VisualRegressionTrackerTest.java › shouldLeaveTheUiTreeOutWhenNotGiven` |
| REQ-012-04 | manual: `backend/src/main.ts` upstream — `new ValidationPipe()`; запит з `uiTree` на upstream VRT приймається |
| REQ-012-05 | manual: підключення за [DEPLOY.md §7](../../../DEPLOY.md) на JDK 11 |
