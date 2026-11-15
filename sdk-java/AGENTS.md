# sdk-java — Java SDK

Загальні правила — у [../AGENTS.md](../AGENTS.md).

**Головне обмеження:** SDK — `ua.vision:vision-sdk`, пакет `ua.vision.sdk`: вихідний SDK 4.3.1 плюс
необов'язкові поля `VisionOptions.uiTree` (XML page source або HTML веб-сторінки; SDK стискає його
gzip + base64 і не надсилає понад 10 МиБ), `featureName` (назва фічі для багів) і `browserVersion`
(спека 050; обидва не входять в ідентичність перевірки), класи `Vision`, `VisionConfig`,
`VisionOptions`, `VisionResult`, `web.WebUiTree` (дерево веб-сторінки спільним скриптом
`../web-tree/collect-tree.js`; gradle копіює його в ресурси під час збірки, другої копії в
репозиторії немає), налаштування `VISION_*` і `vision.json`. Будь-яка інша зміна API — лише за
специфікацією, затвердженою власником; запити до сервера лишаються сумісними, щоб еталони не
скидались. Див. [ADR-0024](../docs/decisions/0024-own-vision-sdk.md), [ADR-0026](../docs/decisions/0026-sdk-own-package-and-versions.md).

## Команди

```bash
gradle test                       # TestNG + MockHttpClient; потрібні JDK 11 і Gradle 7.x
../scripts/build-sdk-jar.sh       # jar і pom → dist/sdk-java/ (версія з build.gradle, зараз 1.0.0)
```

## Правила

- Тест на кожну зміну запиту: перевіряємо JSON, який іде на сервер (`MockHttpClient`).
- Веб-дерево (HTML) іде з `uiTreeFormat: "web"`; дерева Appium — як і раніше, без нього.
  `WebUiTree.collect` ніколи не кидає виняток: при помилці — `null` і `warn` у лог.
- Selenium (`selenium-api`) — лише `compileOnly`: його дає Selenide чи WebDriver тесту.
- Збірка: lombok-плагін 5.1.1 бере старий Lombok, що на JDK 17 падає в `compileJava`; Gradle 8
  не читає `build.gradle` (`reports.xml.enabled`). Тож JDK 11 + Gradle 7.x.
- Готового jar у репозиторії немає: його збирає `scripts/build-sdk-jar.sh` у `dist/sdk-java/`
  (git його ігнорує). Як перейти на нову версію — `DEPLOY.md` §7.
