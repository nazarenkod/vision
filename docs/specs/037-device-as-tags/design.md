# 037 — Дизайн

## Підхід

Один компонент показує профіль пристрою тегами, і його ставимо в кожне місце з REQ-037-03 замість
власного тексту цього місця. Порядок і відбір значень визначає чиста функція `deviceTagsOf`
(модель → ОС → браузер → viewport, порожні пропускає; REQ-037-11 змінив початковий порядок «ОС першою»). Тег — це `Chip size="small"`, як у
колонці «Теги» таблиці перевірок, тому вигляд збігається з еталоном без власних кольорів. Назву
значення показує `Tooltip` з `describeChild`: підказка описує тег, а прочитаною назвою лишається
значення.

У вузьких місцях (таблиця пристроїв огляду збірки, мініатюри груп змін) теги компактні
(`dense`: висота 20 px замість 24 px), щоб ОС і модель уміщалися в один рядок. Стиль той самий:
сірий чип без підпису.

Стан (обраний фільтр, поточний пристрій, показаний еталон) теги не фарбують (REQ-037-04). Його
несе те, що їх тримає: рамка кнопки в смузі пристроїв, риска біля пристрою на картці еталона,
`aria-pressed` у кнопок.

Звіт має власну мову й друкується, тому там той самий компонент працює в режимі `print`: теги
обведені рамкою `tokens.borderStrong`, а назва значення стоїть в атрибуті `title`.

Insights отримує пристрій від сервера одним рядком «модель · ОС», і розібрати його назад не
можна, бо порожні поля в ньому пропущені. Тому сервер додає поряд окремі поля, а старий рядок
лишає для CLI. Якщо відповідь прийшла від старого сервера, пристрій показується одним тегом.

## Компоненти

| Компонент | Шлях | Роль |
|---|---|---|
| `deviceTagsOf` | `frontend/src/_helpers/device.helper.ts` | значення профілю в порядку тегів |
| `DeviceTags` | `frontend/src/components/DeviceTags.tsx` | теги, підказки, режим `print` |
| Картки перевірок | `frontend/src/components/TestRunList/TestRunGrid.tsx` | теги-чипи, клік фільтрує; не більше двох рядків (52 px). `CardTags` міряє, скільки вміщається: спершу вкорочує останній тег, потім ховає його за «+N»; клік по «+N» розгортає всі; ширина змінилась (`ResizeObserver`) — міряє знову |
| Огляд збірки | `frontend/src/components/BuildOverview/index.tsx` | компактні теги + розмір екрана (REQ-037-05); колонки результату й чисел вужчі (56/52/84 px), щоб при 1280 px ОС і модель ішли одним рядком; `DeviceCell` прибрано з `SummaryParts.tsx` |
| Доступність | `frontend/src/components/A11ySummary.tsx` | теги; колонка пристрою 200 px |
| Смуга пристроїв | `frontend/src/components/TestDetailsDialog/DeviceStrip.tsx` | крапка статусу + теги, рамка поточного; теги у вікні «Прийняти всі» |
| Еталони | `frontend/src/components/TestVariationList.tsx`, `TestVariationDetails.tsx` | теги, риска показаного; власні теги — сірий чип, гілка — окрема мітка |
| Insights | `frontend/src/pages/InsightsPage.tsx`, `frontend/src/types/insights.ts` | теги з `profile`/`profiles`, запасний варіант — один тег |
| Налаштування | `frontend/src/components/ProjectForm/AllowedDevicesSettings.tsx` | теги, «дозволено» зеленим текстом (REQ-037-06) |
| Групи змін | `frontend/src/components/ChangeGroups.tsx` | компактні теги з ОС (REQ-037-07); мініатюри вирівняні по верху, бо під ними різна кількість тегів |
| Шапка бага | `frontend/src/components/TestDetailsDialog/ReportBugDialog.tsx` | назва + теги ОС і моделі |
| Звіт | `frontend/src/components/BuildReport/ReportDocument.tsx` | теги `print` у змінах, пристроях і доступності |
| Insights на сервері | `backend/src/analytics/insights.ts` | `profileOf`, поля `profile` і `profiles` |
| Публічний звіт | `backend/src/reports/report-links.ts` | `os` у рядках доступності |

## Дані

Схема бази не змінюється. Відповіді API лише розширюються:

- Insights: `unused[].profile`, `unstable[].profiles` (у тому ж порядку, що й `devices`),
  `coverage[].profile` (покриття Insights більше не показує, поле лишається для CLI). Поля `device` і `devices` лишаються.
- Публічний звіт: `a11y[].os`. ОС уже є в `changes[]` і в таблиці пристроїв, тож нічого
  нового назовні не відкривається. Тест «keeps emails, keys and tokens out…» проходить.

Ключі словника: `baselines.tag.*` прибрано, бо їх замінили `review.attr.*`.
`review.approveDevicesText` і `insights.missing` більше не містять `{devices}`/`{device}`, бо
пристрій тепер показують теги поруч.

## Потік

Без змін: кожен екран бере ті самі дані й передає їх у `DeviceTags`.

## Ризики

| Ризик | Що робимо |
|---|---|
| Чипи ширші за текст, і вузькі місця (картка 160 px, мініатюра групи змін 112 px, колонка 200 px) розпливуться | Теги переносяться (`flex-wrap`), довгий тег обрізається трикрапкою (`maxWidth: 100%`), на картці не більше двох рядків. Кожен екран перевірено скриншотами в обох темах |
| `Tooltip` без `describeChild` перейменує тег на «ОС» для скрінрідера й `getByRole` | `describeChild` |
| Відповідь від сервера без нових полів | Поля в типах необов'язкові, без них пристрій показується одним тегом (тест Insights) |
| Скриншот-еталони Playwright змінюються | Їх перезнімають у Docker (`./test-docker.sh --update-snapshots`), у хмарній сесії Docker немає |

## Перевірка вимог

| Вимога | Перевірка |
|---|---|
| REQ-037-01 | manual: порядок тепер задає REQ-037-11; `frontend/src/_helpers/device.helper.test.ts › leaves out empty values but keeps repeated ones apart` |
| REQ-037-02 | `frontend/src/components/BuildReport/ReportDocument.test.tsx › explains the bars and leaves zeros out of the tables`; manual: навести курсор на тег в огляді збірки й побачити «ОС» / «Пристрій» |
| REQ-037-03 | `frontend/integration_tests/test/insights.spec.ts › shows each device as tags, model first`; manual: пройти екрани з REQ-037-03 і побачити теги |
| REQ-037-04 | manual: клацнути тег на картці, відкрити другий пристрій у смузі пристроїв, вибрати еталон: теги лишаються сірими |
| REQ-037-05 | `frontend/integration_tests/test/buildOverview.spec.ts › shows a device's screen size when the run sent no viewport`; `frontend/src/components/BuildReport/ReportDocument.test.tsx › explains the bars and leaves zeros out of the tables` |
| REQ-037-06 | `frontend/integration_tests/test/projectSettings.spec.ts › marks received devices outside the list and adds one in a click` |
| REQ-037-07 | manual: відкрити групу змін на двох версіях Android однієї моделі й побачити різні теги ОС |
| REQ-037-08 | `frontend/src/components/BuildReport/ReportDocument.test.tsx › shows new screenshots without a baseline and names statuses as the app does`; `backend/src/reports/report-links.spec.ts › names the OS of each accessibility row next to its device` |
| REQ-037-09 | manual: створити баг у Jira й побачити в описі «ОС: … · Пристрій: …», як раніше |
| REQ-037-10 | `frontend/integration_tests/test/testRunGrid.spec.ts › shows +N for the tags that do not fit in two rows` |
| REQ-037-11 | `frontend/src/_helpers/device.helper.test.ts › puts the model first, then the OS, browser and viewport`; `frontend/integration_tests/test/buildOverview.spec.ts › shows a device's screen size when the run sent no viewport` |
