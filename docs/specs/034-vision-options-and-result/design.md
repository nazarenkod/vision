# 034 — Дизайн

## Підхід

Як і в [033](../033-vision-sdk/design.md): перейменування файлів і класів у `sdk-java` без зміни
логіки. `TestRunOptions` → `VisionOptions` (з вкладеним `VisionOptionsBuilder` від Lombok),
`TestRunResult` → `VisionResult`. Параметр `testRunOptions` у `Vision` став `options` — це
внутрішня назва, на API не впливає. Внутрішні `TestRunRequest` і `TestRunResponse` лишаються:
вони описують протокол сервера, а `getTestRunResponse()` — поза межами цього кроку. Тести
перейменовано так само, їхні очікування щодо JSON запитів не змінились. Версія —
`4.3.1-vision.4`.

## Компоненти

| Компонент | Шлях | Роль |
|---|---|---|
| Опції | `sdk-java/src/main/java/ua/vision/sdk/VisionOptions.java` | колишній `TestRunOptions` |
| Результат | `sdk-java/src/main/java/ua/vision/sdk/VisionResult.java` | колишній `TestRunResult` |
| Версія | `sdk-java/build.gradle`, `scripts/build-sdk-jar.sh` | `4.3.1-vision.4` |
| Jar | `dist/sdk-java/` | jar і pom `4.3.1-vision.4` |

## Перевірка вимог

| Вимога | Перевірка |
|---|---|
| REQ-034-01 | `sdk-java/src/test/java/ua/vision/sdk/VisionTest.java › noClassKeepsTheOldTestRunName` |
| REQ-034-02 | `sdk-java/src/test/java/ua/vision/sdk/VisionTest.java › shouldSubmitTestRun`; решта тестів `VisionTest` без змін очікувань |
