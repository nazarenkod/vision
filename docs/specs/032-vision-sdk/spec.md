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
У коді тестів і на CI видно чужий продукт і його спадок:

- клас `VisualRegressionTracker`, пакет `io.visual_regression_tracker`, змінні `VRT_*`, файл
  `vrt.json`, артефакт `com.github.Visual-Regression-Tracker:sdk-java`;
- терміни VRT (`TestRun`, `track`, `stop`), а у Vision це перевірка і збірка;
- друкарська помилка `diffTollerancePercent`, `enableSoftAssert`, `httpTimeoutInSeconds`;
- щоб дізнатися статус і посилання, тест лізе в `getTestRunResponse()`;
- виняток `TestRunException` не дає результату перевірки, лише текст.

Власник вирішив відв'язатися від VRT: перейменувати SDK, його методи, опції, результат і
налаштування на мову Vision. Що SDK робить і що надсилає серверу, не змінюється. Нових параметрів
знімка не додаємо: `uiTree` і фіча вже є.

## Як це виглядає в тесті

Публічні назви — частина контракту з командами, тому вони тут, а не в дизайні.

```java
import vision.*;

Vision vision = new Vision();                         // налаштування з VISION_* або vision.json
vision.startBuild();

CheckResult result = vision.check("Checkout.Payment", screenshotPng, CheckOptions.builder()
        .device("Pixel 7").os("Android 15")
        .uiTree(driver.getPageSource())
        .feature("Checkout")
        .build());                                    // NEW чи CHANGED без softAssert — VisionException
result.getStatus();                                   // PASSED / NEW / CHANGED / REJECTED
result.getUrl();                                      // посилання на рев'ю

vision.finishBuild();
```

### Об'єкт і методи

| Було | Стало |
|---|---|
| `com.github.Visual-Regression-Tracker:sdk-java:4.3.1-vision.2` | `vision:vision-sdk:1.0.0` |
| пакет `io.visual_regression_tracker.sdk_java` | пакет `vision` |
| `VisualRegressionTracker` | `Vision` |
| `start()` | `startBuild()` |
| `stop()` | `finishBuild()` |
| `track(name, imageBase64[, options])` | `check(name, screenshot[, options])`; `screenshot` — байти PNG або рядок base64 |
| `TestRunException` | `VisionException`; `getResult()` — результат, коли виняток через статус перевірки |

### Опції знімка: `TestRunOptions` → `CheckOptions`

| Було | Стало |
|---|---|
| `os`, `device`, `browser`, `viewport` | без змін |
| `customTags` | `tags` |
| `diffTollerancePercent` | `tolerancePercent` |
| `ignoreAreas(List<IgnoreAreas>)` | `ignoreAreas(List<IgnoreArea>)`; `IgnoreArea` — `x`, `y`, `width`, `height` у пікселях |
| `uiTree` | без змін |
| `featureName` | `feature` |

### Результат: `TestRunResult` → `CheckResult`

| Було | Стало |
|---|---|
| `getTestRunResponse().getStatus()` (`OK`, `APPROVED`, `AUTO_APPROVED`, `NEW`, `UNRESOLVED`, `FAILED`) | `getStatus()`: `PASSED` (`ok`, `approved`, `autoApproved`), `NEW`, `CHANGED` (`unresolved`), `REJECTED` (`failed`) |
| `getTestRunResponse().getUrl()` | `getUrl()` |
| `getTestRunResponse().getDiffPercent()` | `getDiffPercent()` |
| `getImageUrl()`, `getBaselineUrl()`, `getDiffUrl()` | без змін |

### Налаштування: `VisualRegressionTrackerConfig` → `VisionConfig`

| Поле було → стало | Змінна оточення | Ключ `vision.json` |
|---|---|---|
| `apiUrl` → `url` | `VISION_URL` | `url` |
| `apiKey` | `VISION_API_KEY` | `apiKey` |
| `project` | `VISION_PROJECT` | `project` |
| `branchName` → `branch` | `VISION_BRANCH` | `branch` |
| `ciBuildId` | `VISION_CI_BUILD_ID` | `ciBuildId` |
| `enableSoftAssert` → `softAssert` | `VISION_SOFT_ASSERT` | `softAssert` |
| `httpTimeoutInSeconds` → `timeoutSeconds` | `VISION_TIMEOUT_SECONDS` | `timeoutSeconds` |

## Користувацькі історії

### US-1 (P1): SDK мовою Vision

Як автоматизатор, я хочу працювати з SDK термінами Vision — збірка, перевірка, результат, — щоб у
тестах і на CI не було назв чужого продукту.

- **Чому P1:** це і є зміна.
- **Незалежна перевірка:** у порожньому Maven-проєкті на JDK 11 підключити `vision:vision-sdk:1.0.0`,
  задати `VISION_URL`, `VISION_API_KEY`, `VISION_PROJECT`, викликати `startBuild`, `check`,
  `finishBuild` → у Vision є завершена збірка з перевіркою.
- **Сценарії приймання:**
  1. **Дано** змінні `VISION_*`, **коли** тест викликає `startBuild`, `check`, `finishBuild`,
     **тоді** у Vision з'являється завершена збірка з перевіркою.
  2. **Дано** `vision.json` у робочій теці й жодної змінної, **коли** тест створює `new Vision()`,
     **тоді** налаштування беруться з файлу.
  3. **Дано** лише `VRT_APIURL`, `VRT_APIKEY`, `VRT_PROJECT` і `vrt.json`, **коли** тест створює
     `new Vision()`, **тоді** виняток називає відсутню `VISION_URL`; старі назви не читаються.
  4. **Дано** скріншот як байти PNG, **коли** тест передає їх у `check`, **тоді** у Vision той
     самий знімок, що й з base64 цих байтів.

### US-2 (P1): Результат перевірки без розбору

Як автоматизатор, я хочу брати статус, посилання й відсоток різниці прямо з результату чи винятку,
щоб не лізти у внутрішню відповідь сервера й не розбирати текст.

- **Чому P1:** це найчастіша дія після `check`.
- **Незалежна перевірка:** з `softAssert` надіслати новий знімок → `getStatus()` дорівнює `NEW`,
  `getUrl()` веде на рев'ю; без `softAssert` → `VisionException`, `getResult()` дає те саме.
- **Сценарії приймання:**
  1. **Дано** знімок, що збігся з еталоном, **коли** `check` завершився, **тоді** `getStatus()` —
     `PASSED`.
  2. **Дано** нову перевірку без `softAssert`, **коли** `check`, **тоді** кидається
     `VisionException` з посиланням у тексті, а `getResult().getStatus()` — `NEW`.
  3. **Дано** відмінність з `softAssert`, **коли** `check` завершився, **тоді** повертається
     `CHANGED` з відсотком різниці, у лог іде помилка з посиланням.
  4. **Дано** недозволений пристрій ([029](../029-allowed-devices/spec.md)), **коли** `check` у
     будь-якому режимі, **тоді** кидається `VisionException` з текстом сервера, а `getResult()` —
     порожній.

### US-3 (P1): Перехід без нових еталонів

Як лід QA, я хочу переводити тести на Vision SDK поступово, щоб наявні еталони лишились і жоден
тест не зламався через перехід.

- **Чому P1:** якщо перехід скидає еталони чи ламає тести, команди не перейдуть.
- **Незалежна перевірка:** перевірка з еталоном зі старого SDK → той самий тест через Vision SDK з
  тими самими значеннями → `PASSED` проти того самого еталона.
- **Сценарії приймання:**
  1. **Дано** еталон, створений старим SDK, **коли** Vision SDK надсилає знімок з тими самими
     назвою, тегами, пристроєм, OS, браузером і viewport, **тоді** знімок порівнюється з цим еталоном.
  2. **Дано** проєкт тестів, де одні тести на старому jar, а інші на новому, **коли** обидва jar у
     classpath, **тоді** обидва працюють.

## Вимоги

| ID | Історія | Вимога |
|---|---|---|
| REQ-032-01 | US-1 | SDK ПОВИНЕН мати пакет, Maven-координати, назви класів, методів, опцій, полів результату й налаштувань з розділу «Як це виглядає в тесті», і жодних назв зі старого SDK у публічному API. |
| REQ-032-02 | US-1 | КОЛИ тест викликає `startBuild`, SDK ПОВИНЕН створити на сервері запущену збірку проєкту на гілці з налаштувань, як старий `start`. |
| REQ-032-03 | US-1 | КОЛИ тест викликає `finishBuild`, SDK ПОВИНЕН завершити збірку на сервері, як старий `stop`. |
| REQ-032-04 | US-1 | ЯКЩО тест викликає `check` або `finishBuild` до `startBuild`, ТО SDK ПОВИНЕН кинути `VisionException` без запиту до сервера. |
| REQ-032-05 | US-1 | SDK ПОВИНЕН приймати скріншот у `check` як байти PNG або як рядок base64 і надсилати серверу однаковий запит для тих самих байтів. |
| REQ-032-06 | US-1 | SDK ПОВИНЕН брати кожне налаштування спершу з явно заданого в коді, потім зі змінної `VISION_*`, потім з `vision.json` у робочій теці, з назвами з таблиці налаштувань. |
| REQ-032-07 | US-1 | SDK ПОВИНЕН не читати змінні `VRT_*` і файл `vrt.json`. |
| REQ-032-08 | US-1 | ЯКЩО адреса, ключ або проєкт не задані жодним способом, ТО SDK ПОВИНЕН кинути виняток до будь-якого запиту, де названо налаштування і його змінну `VISION_*`. |
| REQ-032-09 | US-1 | ДЕ `softAssert` і `timeoutSeconds` не задані, SDK ПОВИНЕН вважати `softAssert` вимкненим, а тайм-аут — 10 с, як старий SDK. |
| REQ-032-10 | US-1 | SDK ПОВИНЕН писати в лог «Vision» і терміни «збірка»/«перевірка» (англійською: build, check) замість «Visual Regression Tracker» і «test run». |
| REQ-032-11 | US-2 | КОЛИ сервер повернув результат перевірки, `check` ПОВИНЕН віддавати `CheckResult` зі статусом `PASSED`, `NEW`, `CHANGED` або `REJECTED` за таблицею результату, посиланням на рев'ю, відсотком різниці й посиланнями на знімок, еталон і різницю. |
| REQ-032-12 | US-2 | ЯКЩО статус `NEW` або `CHANGED` і `softAssert` вимкнено, ТО SDK ПОВИНЕН кинути `VisionException` з посиланням у тексті та цим `CheckResult` у `getResult()`. |
| REQ-032-13 | US-2 | ДЕ `softAssert` увімкнено, КОЛИ статус `NEW` або `CHANGED`, SDK ПОВИНЕН записати в лог помилку з посиланням і повернути `CheckResult`. |
| REQ-032-14 | US-2 | ЯКЩО сервер відповів помилкою (зокрема відхилив пристрій, REQ-029-05), ТО SDK ПОВИНЕН кинути `VisionException` з текстом сервера в будь-якому режимі, з порожнім `getResult()`. |
| REQ-032-15 | US-3 | SDK ПОВИНЕН надсилати серверу запити, ідентичні запитам старого SDK з відповідними значеннями (`tags` як `customTags`, `tolerancePercent` як `diffTollerancePercent`, `feature` як `featureName`), щоб ідентичність перевірок і еталони не змінились, а сервер не потребував змін. |
| REQ-032-16 | US-3 | SDK ПОВИНЕН підключатися в один проєкт тестів разом зі старим SDK без конфлікту класів. |
| REQ-032-17 | US-1 | SDK ПОВИНЕН працювати на Java 11+ і підключатися до Maven- чи Gradle-проєкту без корпоративного репозиторію. |

## Граничні випадки

- На CI задано і `VRT_*`, і `VISION_*` → діють лише `VISION_*` (REQ-032-06, REQ-032-07).
- У робочій теці лежать і `vrt.json`, і `vision.json` → читається лише `vision.json` (REQ-032-07).
- Тест мігрував, а CI ще має лише `VRT_*` → виняток називає `VISION_URL`, а не
  `NullPointerException` (REQ-032-08).
- `VISION_SOFT_ASSERT=yes` → не `true`, тож `softAssert` вимкнено, як `Boolean.parseBoolean` у
  старому SDK (REQ-032-09).
- `VISION_TIMEOUT_SECONDS=abc` → виняток з назвою змінної до будь-якого запиту (REQ-032-08).
- Сервер повернув статус, якого SDK не знає → `VisionException` з текстом статусу, а не тихий
  `PASSED` (REQ-032-11).
- Порожній масив байтів чи порожній base64 → `VisionException` без запиту (REQ-032-05).
- Старий і новий SDK в одній збірці CI з тим самим `ciBuildId` → обидва пишуть в одну збірку, бо
  запити однакові (REQ-032-15).

## Ключові сутності

- **Збірка** — один прогін тестів; її стартує `startBuild` і завершує `finishBuild`.
- **Перевірка** — назва + теги + пристрій ([001](../001-check-identity/spec.md)); не змінюється.
- **Результат перевірки** — статус, посилання, відсоток різниці, посилання на зображення.

## Критерії успіху

| ID | Критерій |
|---|---|
| SC-032-01 | Перехід тесту зі старого SDK — механічна заміна за таблицями «Було → Стало»; жодної зміни логіки тесту. |
| SC-032-02 | Перехід не створює нових еталонів: 0 знімків зі статусом `NEW` для перевірок, що мали еталон. |
| SC-032-03 | У публічних назвах, змінних, файлі налаштувань, лозі й документації SDK немає «VRT», «Visual Regression Tracker» чи «TestRun». |

## Припущення

- Протокол сервера (адреси запитів, заголовки, поля JSON) не змінюється; його перейменування —
  окреме рішення.
- Старий jar `4.3.1-vision.2` лишається доступним для тестів, які ще не перейшли, але більше не
  оновлюється.

## Поза межами

- Нові параметри знімка: власник вважає, що потрібні вже є.
- Модуль для Appium, try-with-resources, надсилання з кількох потоків як гарантія — наступні кроки
  окремою специфікацією.
- Сумісні класи зі старими назвами в новому jar і читання `VRT_*` — рішення власника: лише нові
  назви.

## Чекліст якості специфікації

- [x] Немає деталей реалізації (файлів, таблиць, бібліотек); публічні назви — контракт із командами.
- [x] Кожна вимога перевірювана й однозначна; немає «швидко», «зручно», «за потреби».
- [x] Кожна історія має незалежну перевірку і сценарії приймання.
- [x] Критерії успіху вимірювані.
- [x] Граничні випадки й «поза межами» розглянуто.
- [x] Не лишилось `[ПОТРЕБУЄ УТОЧНЕННЯ]` — тоді можна в `Approved`.
