# 040 — Дизайн

## Підхід

**Сервер.** Перед розбором дерево проходить через чисту функцію `readUiTreeXml`: декодує base64,
розпаковує gzip з межею `maxOutputLength` у 10 МиБ (10 485 760 байтів) і відмовляє, коли межу
перевищено або в дереві є `<!DOCTYPE` чи `<!ENTITY`. Повертає або XML, або причину, з якої
дерево не взято. `UiTreeService.store` логує причину (REQ-040-04) і повертає `null`, як і для
дерева, яке не вдалося прочитати: знімок приймається без дерева тим самим шляхом, що й зараз
(як для не-Appium дерева у 002).

Розгортання стандартних сутностей (`&amp;`, `&#x1F686;`) лишається: ними Appium пише тексти, і
від них залежать тексти елементів та ідентичність проблем доступності (REQ-040-06). Небезпечні
лише власні сутності, а їх без `DOCTYPE` не оголосити, тому відмова на `DOCTYPE` закриває
«billion laughs» до того, як дерево потрапить у парсер. Парсер `fast-xml-parser` оновлюється з
4.5 до 5.12 — версії без відомих вразливостей.

Межа розпакування робить `store` обмеженим у часі: не більше 10 МиБ на запит замість
необмежених гігабайтів, тож event loop не блокується (REQ-040-05).

**SDK.** `Vision.encodeUiTree` міряє дерево в байтах UTF-8. Якщо їх більше 10 МиБ, повертає
`null` і пише `warn` з назвою перевірки й розміром; тоді поле `uiTree` у запиті відсутнє, як і
без дерева (REQ-040-07). Інакше запит той самий (REQ-040-08). Пакет `io.visual_regression_tracker.sdk_java`
переїжджає в `ua.vision.sdk` (класи й методи не змінюються), змінні `VRT_*` → `VISION_*`,
`vrt.json` → `vision.json`, лог — «Vision». Maven: `ua.vision:vision-sdk:1.0.0`. Рішення про
власний пакет і нумерацію без сумісності зі старими назвами — [ADR-0026](../../decisions/0026-sdk-own-package-and-versions.md).

## Компоненти

| Компонент | Шлях | Роль |
|---|---|---|
| `readUiTreeXml`, `UI_TREE_MAX_BYTES` | `backend/src/ui-tree/ui-tree.intake.ts` | чиста функція прийому: base64 → XML або причина відмови |
| `UiTreeService.store` | `backend/src/ui-tree/ui-tree.service.ts` | викликає `readUiTreeXml`, логує відмову з назвою перевірки й проєктом |
| `TestRunsService.postTestRun` | `backend/src/test-runs/test-runs.service.ts` | передає в `store` назву перевірки й проєкт |
| парсер | `backend/src/ui-tree/ui-tree.parser.ts` | `fast-xml-parser` 5.12, ті самі опції |
| `Vision.encodeUiTree`, `UI_TREE_MAX_BYTES` | `sdk-java/src/main/java/ua/vision/sdk/Vision.java` | ліміт у SDK, лог «Vision» |
| `VisionConfig` | `sdk-java/src/main/java/ua/vision/sdk/VisionConfig.java` | префікс `VISION_` |
| збірка SDK | `sdk-java/build.gradle`, `settings.gradle`, `scripts/build-sdk-jar.sh` | `ua.vision:vision-sdk:1.0.0` |
| контрольний сценарій | `backend/test_control/` | новий пакет SDK; крок із ворожими деревами |

## Дані

Без змін у базі. Дерева, відкинуті через ліміт, не зберігаються, як і зараз ті, що не вдалося
прочитати.

## Потік

```
SDK track(name, png, uiTree)
  └─ uiTree > 10 МиБ? → warn у лог SDK, запит без uiTree
POST /test-runs
  └─ store(uiTree, {name, projectId})
       └─ readUiTreeXml: base64 → gunzip ≤ 10 МиБ → без DOCTYPE/ENTITY → XML
            ├─ відмова → warn у лог сервера, знімок без дерева
            └─ XML → parseUiTree (як раніше)
```

## Ризики

| Ризик | Що робимо |
|---|---|
| Парсер 5.x розбирає інакше (порядок, атрибути, тексти) | усі тести `ui-tree` і контрольний сценарій мають лишитися зеленими без зміни еталона |
| Справжні дерева з `DOCTYPE` | Appium і uiautomator його не пишуть; фікстури Android і iOS без нього; якщо з'явиться, знімок прийметься без дерева, а лог скаже чому |
| Тестові проєкти лишаться на старому jar зі змінними `VRT_*` | новий jar не читає старих змінних і каже, яких налаштувань бракує; заміна описана в `dist/sdk-java/README.md` |
| Спільні `node_modules` інших сесій | оновлення робиться у власних `node_modules` цього worktree |

## Перевірка вимог

| Вимога | Перевірка |
|---|---|
| REQ-040-01 | `backend/src/ui-tree/ui-tree.intake.spec.ts › takes a gzipped tree of exactly 10 MiB` |
| REQ-040-02 | `backend/src/ui-tree/ui-tree.intake.spec.ts › stops unpacking at 10 MiB and leaves the tree out` |
| REQ-040-03 | `backend/src/ui-tree/ui-tree.intake.spec.ts › leaves out a tree that declares entities, without expanding them` |
| REQ-040-04 | `backend/src/ui-tree/ui-tree.service.spec.ts › logs which check and project lost its tree, and why` |
| REQ-040-05 | `backend/test_control/scenario.control.ts › 19 hostile UI trees` |
| REQ-040-06 | `backend/src/ui-tree/ui-tree.parser.spec.ts › shows emoji the dump wrote as character references` |
| REQ-040-07 | `sdk-java/src/test/java/ua/vision/sdk/VisionTest.java › leavesOutUiTreeOverTheLimit` |
| REQ-040-08 | `sdk-java/src/test/java/ua/vision/sdk/VisionTest.java › sendsUiTreeAtTheLimit` |
| REQ-040-09 | `sdk-java/src/test/java/ua/vision/sdk/VisionTest.java › livesInTheVisionPackageOnly` |
| REQ-040-10 | `scripts/tests/test_build_sdk_jar.py › test_publishes_ua_vision_vision_sdk_with_its_own_version` |
| REQ-040-11 | `sdk-java/src/test/java/ua/vision/sdk/VisionConfigTest.java › ignoresVrtVariables` |
| REQ-040-12 | `sdk-java/src/test/java/ua/vision/sdk/VisionTest.java › logsUnderTheVisionName` |
| REQ-040-13 | `backend/test_control/scenario.control.ts › 05 second SDK build: a changed fee, the same offers` |
