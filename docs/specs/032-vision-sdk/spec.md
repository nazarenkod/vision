# 032 — Vision SDK: власні назви замість VRT

| | |
|---|---|
| Статус | Draft |
| Власник | Дмитро Назаренко |
| Оновлено | 2026-11-01 |
| Дизайн | — (з'являється після `Approved`) |
| Пов'язане | [ADR-0023](../../decisions/0023-own-vision-sdk.md) (замінює [ADR-0019](../../decisions/0019-sdk-upstream-plus-ui-tree-and-feature.md)); змінює [012](../012-java-sdk/spec.md) REQ-012-01; [025](../025-bug-from-comparison/spec.md) (назва фічі), [029](../029-allowed-devices/spec.md) (дозволені пристрої) |

## Контекст і проблема

Автотести надсилають знімки через форк upstream Java SDK VRT 4.3.1 з двома доданими полями
([012](../012-java-sdk/spec.md), [ADR-0019](../../decisions/0019-sdk-upstream-plus-ui-tree-and-feature.md)).
У коді тестів і на CI видно чужий продукт: клас `VisualRegressionTracker`, пакет
`io.visual_regression_tracker`, змінні `VRT_*`, файл `vrt.json`, артефакт
`com.github.Visual-Regression-Tracker:sdk-java`, термін VRT «test run» (`TestRunOptions`,
`TestRunResult`, `getTestRunResponse()`), а у Vision це перевірка (check). Власник вирішив
відв'язатися від VRT.

Що SDK робить і що надсилає серверу, не змінюється. Нових параметрів і методів не додаємо.

## Правила перейменування

Щоб назви були послідовні, кожна публічна назва проходить три правила, без винятків:

1. **Назва VRT → назва Vision.** «Visual Regression Tracker», «VRT» → «Vision»; «test run» і
   `track` → «check» (перевірка, як у [словнику](../../product/glossary.md)).
2. **Друкарська помилка → виправлено.** `Tollerance` → `Tolerance`.
3. **Усе інше — без змін.** Назва збігається зі старим SDK, а статуси — з тими, що показує
   інтерфейс Vision (`new`, `unresolved`, `failed`, `approved`, `autoApproved`, `ok`).

## Як це виглядає в тесті

Публічні назви — частина контракту з командами, тому вони тут, а не в дизайні. Таблиця охоплює
весь публічний API; рядок «без змін» означає, що назва та сама.

| Що | Було | Стало | Правило |
|---|---|---|---|
| Maven-артефакт | `com.github.Visual-Regression-Tracker:sdk-java:4.3.1-vision.2` | `vision:vision-sdk:1.0.0` | 1 |
| Пакет | `io.visual_regression_tracker.sdk_java` | `vision` | 1 |
| Головний клас | `VisualRegressionTracker` | `Vision` | 1 |
| Почати збірку | `start()` | без змін | 3 |
| Надіслати знімок | `track(name, imageBase64[, options])` | `check(name, imageBase64[, options])` | 1 |
| Завершити збірку | `stop()` | без змін | 3 |
| Опції знімка | `TestRunOptions` | `CheckOptions` | 1 |
| Поля опцій | `os`, `browser`, `viewport`, `device`, `customTags`, `ignoreAreas`, `uiTree`, `featureName` | без змін | 3 |
| Допуск різниці | `diffTollerancePercent` | `diffTolerancePercent` | 2 |
| Область без порівняння | `IgnoreAreas` (`x`, `y`, `width`, `height`) | без змін | 3 |
| Результат | `TestRunResult` | `CheckResult` | 1 |
| Відповідь сервера в результаті | `getTestRunResponse().getX()` | `getX()` прямо в `CheckResult` | 1 |
| Поля результату | `getId`, `getStatus`, `getUrl`, `getDiffPercent`, `getPixelMisMatchCount`, `getMerge`, `getImageName`, `getBaselineName`, `getDiffName`, `getImageUrl`, `getBaselineUrl`, `getDiffUrl` | без змін | 3 |
| Допуск у результаті | `getDiffTollerancePercent` | `getDiffTolerancePercent` | 2 |
| Статус | `TestRunStatus` | `CheckStatus` | 1 |
| Значення статусу | `OK`, `NEW`, `UNRESOLVED`, `FAILED`, `APPROVED`, `AUTO_APPROVED` | без змін | 3 |
| Виняток | `TestRunException` | `VisionException` | 1 |
| Налаштування | `VisualRegressionTrackerConfig` | `VisionConfig` | 1 |
| Поля налаштувань | `apiUrl`, `apiKey`, `project`, `branchName`, `ciBuildId`, `enableSoftAssert`, `httpTimeoutInSeconds` | без змін | 3 |
| Змінні оточення | `VRT_` + назва поля великими літерами: `VRT_APIURL`, `VRT_APIKEY`, … | `VISION_` + назва поля великими літерами: `VISION_APIURL`, `VISION_APIKEY`, … | 1 |
| Файл налаштувань | `vrt.json` | `vision.json`, ключі — назви полів | 1 |

`VisionException` названо за SDK, а не «check», бо його кидають і налаштування, і `start`, і
`stop`, як і старий `TestRunException`.

```java
import vision.*;

Vision vision = new Vision();                         // VISION_APIURL, VISION_APIKEY, VISION_PROJECT або vision.json
vision.start();
CheckResult result = vision.check("Checkout.Payment", screenshotBase64, CheckOptions.builder()
        .device("Pixel 7").os("Android 15")
        .uiTree(driver.getPageSource())
        .featureName("Checkout")
        .build());
result.getStatus();                                   // CheckStatus.OK, NEW, UNRESOLVED, …
result.getUrl();
vision.stop();
```

## Користувацькі історії

### US-1 (P1): SDK під назвою Vision

Як автоматизатор, я хочу працювати з SDK під назвою Vision і її термінами, щоб у тестах і на CI не
було назв чужого продукту.

- **Чому P1:** це і є зміна.
- **Незалежна перевірка:** у порожньому Maven-проєкті на JDK 11 підключити `vision:vision-sdk:1.0.0`,
  задати `VISION_APIURL`, `VISION_APIKEY`, `VISION_PROJECT`, викликати `start`, `check`, `stop` →
  у Vision є завершена збірка з перевіркою.
- **Сценарії приймання:**
  1. **Дано** змінні `VISION_*`, **коли** тест викликає `start`, `check`, `stop`, **тоді** у Vision
     з'являється завершена збірка з перевіркою.
  2. **Дано** `vision.json` у робочій теці й жодної змінної, **коли** тест створює `new Vision()`,
     **тоді** налаштування беруться з файлу.
  3. **Дано** лише `VRT_APIURL`, `VRT_APIKEY`, `VRT_PROJECT` і `vrt.json`, **коли** тест створює
     `new Vision()`, **тоді** виняток називає відсутню `VISION_APIURL`; старі назви не читаються.
  4. **Дано** знімок, що збігся з еталоном, **коли** `check` завершився, **тоді**
     `result.getStatus()` — `OK`, а `result.getUrl()` веде на знімок у Vision.

### US-2 (P1): Перехід без нових еталонів

Як лід QA, я хочу переводити тести на Vision SDK поступово, щоб наявні еталони лишились і жоден
тест не зламався через перехід.

- **Чому P1:** якщо перехід скидає еталони чи ламає тести, команди не перейдуть.
- **Незалежна перевірка:** перевірка з еталоном зі старого SDK → той самий тест через Vision SDK з
  тими самими значеннями → `OK` проти того самого еталона.
- **Сценарії приймання:**
  1. **Дано** еталон, створений старим SDK, **коли** Vision SDK надсилає знімок з тими самими
     назвою, тегами, пристроєм, OS, браузером і viewport, **тоді** знімок порівнюється з цим еталоном.
  2. **Дано** проєкт тестів, де одні тести на старому jar, а інші на новому, **коли** обидва jar у
     classpath, **тоді** обидва працюють.

## Вимоги

| ID | Історія | Вимога |
|---|---|---|
| REQ-032-01 | US-1 | SDK ПОВИНЕН мати всі публічні назви з таблиці «Було → Стало» і жодної назви з «VisualRegressionTracker», «VRT», «TestRun» чи «Tollerance» у публічному API. |
| REQ-032-02 | US-1 | `start`, `check` і `stop` ПОВИННІ поводитися так само, як старі `start`, `track` і `stop`: ті самі запити, той самий soft assert, ті самі помилки, коли збірку не почато. |
| REQ-032-03 | US-1 | SDK ПОВИНЕН брати кожне налаштування спершу з явно заданого в коді, потім зі змінної `VISION_<ПОЛЕ>`, потім з `vision.json` у робочій теці. |
| REQ-032-04 | US-1 | SDK ПОВИНЕН не читати змінні `VRT_*` і файл `vrt.json`. |
| REQ-032-05 | US-1 | ЯКЩО адреса, ключ або проєкт не задані жодним способом, ТО SDK ПОВИНЕН кинути виняток до будь-якого запиту, де названо поле і його змінну `VISION_*`. |
| REQ-032-06 | US-1 | `CheckResult` ПОВИНЕН давати прямо всі поля відповіді сервера про перевірку й посилання на знімок, еталон і різницю, з назвами з таблиці. |
| REQ-032-07 | US-1 | ЯКЩО статус `NEW` або `UNRESOLVED` і soft assert вимкнено, ТО `check` ПОВИНЕН кинути `VisionException` з посиланням, як старий `track`. |
| REQ-032-08 | US-1 | ДЕ soft assert увімкнено, КОЛИ статус `NEW` або `UNRESOLVED`, SDK ПОВИНЕН записати в лог помилку з посиланням і повернути `CheckResult`, як старий `track`. |
| REQ-032-09 | US-1 | ЯКЩО сервер відповів помилкою (зокрема відхилив пристрій, REQ-029-05), ТО SDK ПОВИНЕН кинути `VisionException` з текстом сервера в будь-якому режимі. |
| REQ-032-10 | US-1 | SDK ПОВИНЕН писати в лог «Vision» і «check» замість «Visual Regression Tracker» і «test run». |
| REQ-032-11 | US-2 | SDK ПОВИНЕН надсилати серверу запити, ідентичні запитам старого SDK з тими самими значеннями (`diffTolerancePercent` іде в те саме поле, що й старий `diffTollerancePercent`), щоб ідентичність перевірок і еталони не змінились, а сервер не потребував змін. |
| REQ-032-12 | US-2 | SDK ПОВИНЕН підключатися в один проєкт тестів разом зі старим SDK без конфлікту класів. |
| REQ-032-13 | US-1 | SDK ПОВИНЕН працювати на Java 11+ і підключатися до Maven- чи Gradle-проєкту без корпоративного репозиторію. |

## Граничні випадки

- На CI задано і `VRT_*`, і `VISION_*` → діють лише `VISION_*` (REQ-032-03, REQ-032-04).
- У робочій теці лежать і `vrt.json`, і `vision.json` → читається лише `vision.json` (REQ-032-04).
- Тест мігрував, а CI ще має лише `VRT_*` → виняток називає `VISION_APIURL`, а не
  `NullPointerException` (REQ-032-05).
- `VISION_ENABLESOFTASSERT=yes` → soft assert вимкнено, як у старому SDK (REQ-032-02).
- `check` чи `stop` до `start` → `VisionException`, як і раніше (REQ-032-02).
- Сервер повернув статус, якого SDK не знає → `VisionException` з цим статусом у тексті, а не
  мовчазний успіх (REQ-032-07).
- Старий і новий SDK в одній збірці CI з тим самим `ciBuildId` → обидва пишуть в одну збірку, бо
  запити однакові (REQ-032-11).

## Ключові сутності

Без змін: збірка, перевірка ([001](../001-check-identity/spec.md)), знімок.

## Критерії успіху

| ID | Критерій |
|---|---|
| SC-032-01 | Перехід тесту зі старого SDK — механічна заміна за таблицею «Було → Стало»; жодної зміни логіки тесту. |
| SC-032-02 | Перехід не створює нових еталонів: 0 знімків зі статусом `new` для перевірок, що мали еталон. |
| SC-032-03 | Кожна назва в таблиці «Було → Стало» має одне з трьох правил, і жодна не порушує їх. |

## Припущення

- Протокол сервера (адреси запитів, заголовки, поля JSON) не змінюється; його перейменування —
  окреме рішення.
- Старий jar `4.3.1-vision.2` лишається доступним для тестів, які ще не перейшли, але більше не
  оновлюється.

## Поза межами

- Нові параметри знімка: власник вважає, що потрібні вже є.
- Нові можливості (скріншот байтами PNG, результат у винятку, модуль для Appium,
  try-with-resources) — наступні кроки окремою специфікацією.
- Сумісні класи зі старими назвами в новому jar і читання `VRT_*` — рішення власника: лише нові
  назви.

## Чекліст якості специфікації

- [x] Немає деталей реалізації (файлів, таблиць, бібліотек); публічні назви — контракт із командами.
- [x] Кожна вимога перевірювана й однозначна; немає «швидко», «зручно», «за потреби».
- [x] Кожна історія має незалежну перевірку і сценарії приймання.
- [x] Критерії успіху вимірювані.
- [x] Граничні випадки й «поза межами» розглянуто.
- [x] Не лишилось `[ПОТРЕБУЄ УТОЧНЕННЯ]` — тоді можна в `Approved`.
