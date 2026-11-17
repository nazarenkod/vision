# Vision Java SDK

`ua.vision:vision-sdk` надсилає знімки екранів з автотестів у Vision разом з UI-деревом екрана.
Для Appium (Android, iOS), Selenide і Selenium. Java 11+.

## Встановлення

Зібрати jar (потрібні JDK 11 і Gradle 7) і встановити в локальний Maven:

```sh
./scripts/build-sdk-jar.sh    # з кореня репозиторію → dist/sdk-java/
mvn install:install-file -Dfile=dist/sdk-java/vision-sdk-1.0.0.jar -DpomFile=dist/sdk-java/vision-sdk-1.0.0.pom
```

```xml
<dependency>
    <groupId>ua.vision</groupId>
    <artifactId>vision-sdk</artifactId>
    <version>1.0.0</version>
</dependency>
```

Gradle: `implementation 'ua.vision:vision-sdk:1.0.0'` з `mavenLocal()`. У Nexus:
`gradle publish -PrepoUrl=https://nexus.example.com/repository/maven-releases/ -PrepoUser=… -PrepoPassword=…`.

## Налаштування

Змінні середовища або файл `vision.json` у корені проєкту тестів:

| Поле | Змінна | Що це |
|---|---|---|
| `apiUrl` | `VISION_APIURL` | адреса API Vision |
| `apiKey` | `VISION_APIKEY` | API-ключ з **Profile → API key** |
| `project` | `VISION_PROJECT` | назва або ID проєкту |
| `branchName` | `VISION_BRANCHNAME` | гілка |
| `ciBuildId` | `VISION_CIBUILDID` | ID збірки в CI, необов'язково |
| `enableSoftAssert` | `VISION_ENABLESOFTASSERT` | `true` — лог замість падіння тесту |
| `httpTimeoutInSeconds` | `VISION_HTTPTIMEOUTINSECONDS` | типово 10 |

```json
{
  "apiUrl": "http://localhost:14200",
  "apiKey": "YOUR_API_KEY",
  "project": "Mobile Shop",
  "branchName": "develop"
}
```

Пріоритет: `VisionConfig.builder()…build()` у коді → змінні → `vision.json`.

## Мобільний екран

```java
Vision vision = new Vision();
vision.start();

// щільність екрана в dpi (420, а не 2.625): досить узяти один раз на сесію
int density = ((Number) driver.executeScript("mobile: getDisplayDensity")).intValue();

vision.track("Checkout", driver.getScreenshotAs(OutputType.BASE64), VisionOptions.builder()
        .device("Pixel 8")
        .os("Android 14")
        .uiTree(driver.getPageSource())
        .deviceDensity(density)    // Android: розміри в dp точні, а не оцінені
        .featureName("Checkout")   // необов'язково: назва фічі в багах
        .build());

vision.stop();
```

Без `deviceDensity` сервер оцінює щільність з розміру скриншота (коротка сторона ≈ 411 dp) і
позначає розміри як приблизні: на планшетах і пристроях зі зміненим розміром інтерфейсу оцінка
помиляється в 1,5–2 рази. `mobile: getDisplayDensity` є в UiAutomator2 з версії 2.21; на старішому
драйвері те саме число дає `adb shell wm density`. Не плутайте з `displayDensity` з
`mobile: deviceInfo` — це співвідношення пікселів; число поза 100–1000 SDK не надсилає й пише
попередження в лог. Для iOS і вебу щільність не потрібна.

## Вебсторінка

```java
String tree = WebUiTree.collect((JavascriptExecutor) WebDriverRunner.getWebDriver());
vision.track("Cart", Selenide.screenshot(OutputType.BASE64), VisionOptions.builder()
        .browser("chrome")
        .viewport("1280x800")
        .uiTree(tree)
        .build());
```

`WebUiTree.collect(driver, true)` — для знімка всієї сторінки.

## Опції

| Опція | Що це |
|---|---|
| `device`, `os`, `browser`, `viewport`, `customTags` | для кожного поєднання — свій еталон |
| `uiTree` | page source Appium або `WebUiTree.collect`; понад 10 МиБ не надсилається |
| `featureName` | фіча для назви бага |
| `browserVersion` | версія браузера, лише для показу |
| `deviceDensity` | щільність екрана Android у dpi, для точних розмірів у dp; поза 100–1000 не надсилається |
| `diffTollerancePercent` | допустимий відсоток змін |
| `ignoreAreas` | області, які не порівнюються |

`track` повертає `VisionResult` зі статусом і посиланнями на знімок, diff і еталон. Знімок з
пристрою, якого немає в дозволених пристроях проєкту, відхиляється з `TestRunException`.

## Ліцензія

Apache-2.0 ([LICENSE](LICENSE)).
