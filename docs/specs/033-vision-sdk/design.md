# 033 — Дизайн

## Підхід

Перейменування файлів і класів у наявному `sdk-java`, без зміни логіки: `VisualRegressionTracker`
→ `Vision`, `VisualRegressionTrackerConfig` → `VisionConfig` (разом з вкладеним
`VisionConfigBuilder`). Пакет, захищені поля й методи, тексти логу, назви змінних `VRT_*` і
`vrt.json` лишаються, бо специфікація змінює лише назви двох класів. Тести перейменовано так само;
їхні очікування щодо JSON запитів не змінились — це і є перевірка REQ-033-02. Версія
публікації — `4.3.1-vision.3`, координати ті самі.

## Компоненти

| Компонент | Шлях | Роль |
|---|---|---|
| Головний клас | `sdk-java/src/main/java/ua/vision/sdk/Vision.java` | колишній `VisualRegressionTracker` |
| Налаштування | `sdk-java/src/main/java/ua/vision/sdk/VisionConfig.java` | колишній `VisualRegressionTrackerConfig` |
| Версія | `sdk-java/build.gradle`, `scripts/build-sdk-jar.sh` | `4.3.1-vision.3` |
| Jar | dist/sdk-java/ (збирає скрипт, не в git) | jar і pom `4.3.1-vision.3` |

## Ризики

- Тести команд не компілюються з новим jar, доки не замінять дві назви. Пом'якшення: стара версія
  лишається в їхніх локальних Maven-репозиторіях і в історії git; DEPLOY.md описує заміну.

## Перевірка вимог

| Вимога | Перевірка |
|---|---|
| REQ-033-01 | `sdk-java/src/test/java/ua/vision/sdk/VisionTest.java › noClassKeepsTheOldVisualRegressionTrackerName` |
| REQ-033-02 | `sdk-java/src/test/java/ua/vision/sdk/VisionTest.java › shouldSubmitTestRun`; решта тестів `VisionTest` без змін очікувань |
| REQ-033-03 | `sdk-java/src/test/java/ua/vision/sdk/VisionConfigTest.java › shouldResolveFinalValuesInTheRightOrder` |
