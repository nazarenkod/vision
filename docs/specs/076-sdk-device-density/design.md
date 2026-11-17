# 076 — Дизайн

## Підхід

Сервер уже приймає `deviceDensity` (dpi) у `POST /test-runs` і передає її в розбір дерева як
`densityDpi`; там Android рахує `pixelsPerDp = scale × dpi / 160`, а iOS і веб її не читають.
Тож уся зміна — у Java SDK: нове необов'язкове поле `VisionOptions.deviceDensity` (`Integer`), яке
`Vision.submitTestRun` кладе в запит. Gson пропускає `null`, тож без поля JSON той самий, що й
раніше (REQ-076-02).

Значення поза 100–1000 dpi SDK не надсилає (`Vision.deviceDensity`): частіша помилка — передати
співвідношення пікселів (2,625 → 2 чи 3), і тоді всі розміри в dp зросли б у сотні разів, а
знахідки мовчки зникли б. Без щільності сервер оцінить її й чесно скаже, що розміри приблизні.
Тест не падає: SDK лише пише `warn` у лог, як і для завеликого дерева (040).

Сервер не змінюється; додано тести, що закріплюють уже наявну поведінку (REQ-076-04, 05).

Приклад у README бере щільність з Appium через `mobile: getDisplayDensity` (UiAutomator2 ≥ 2.21,
ціле число dpi). `mobile: deviceInfo` → `displayDensity` не беремо: за документацією драйвера це
`DisplayMetrics.density`, тобто співвідношення, а не dpi.

## Компоненти

| Компонент | Шлях | Роль |
|---|---|---|
| Опція знімка | `sdk-java/src/main/java/ua/vision/sdk/VisionOptions.java` | `deviceDensity` |
| Запит | `sdk-java/src/main/java/ua/vision/sdk/request/TestRunRequest.java` | поле `deviceDensity` |
| Надсилання | `sdk-java/src/main/java/ua/vision/sdk/Vision.java` | `deviceDensity(name, dpi)`: межі 100–1000, інакше `null` і `warn` |
| Документація SDK | `sdk-java/README.md`, `sdk-java/AGENTS.md`, `AGENTS.md` (правило 5) | приклад з Appium, перелік змін SDK |

## Дані

Нічого нового: щільність і далі лише впливає на `pixelsPerDp` у файлі дерева знімка.

## Ризики

| Ризик | Що робимо |
|---|---|
| Передали співвідношення пікселів замість dpi | межі 100–1000 і `warn`; у README прямо сказано, що потрібні dpi |
| Старий драйвер UiAutomator2 без `mobile: getDisplayDensity` | у README — `adb shell wm density` як запасний варіант |
| Збірка SDK на JDK 11 + Gradle 7 | нічого нового в збірці; тести прогнано й на JDK 21 з Gradle 8 у копії |

## Перевірка вимог

| Вимога | Перевірка |
|---|---|
| REQ-076-01 | `sdk-java/src/test/java/ua/vision/sdk/VisionTest.java › sendsTheScreenDensityWhenGiven` |
| REQ-076-02 | `sdk-java/src/test/java/ua/vision/sdk/VisionTest.java › leavesOutTheScreenDensityWhenNotGiven` |
| REQ-076-03 | `sdk-java/src/test/java/ua/vision/sdk/VisionTest.java › leavesOutAScreenDensityNoScreenHasAndWarns` |
| REQ-076-04 | `backend/src/test-runs/test-runs.service.spec.ts › reads the UI tree at the screen density the client sent` |
| REQ-076-05 | `backend/src/ui-tree/ui-tree.parser.spec.ts › ignores a screen density sent with an iOS tree…` |
| REQ-076-06 | `manual: у sdk-java/README.md розділ «Мобільний екран» має приклад з mobile: getDisplayDensity і пояснення, що потрібні dpi; на емуляторі Android число збігається з adb shell wm density` |
