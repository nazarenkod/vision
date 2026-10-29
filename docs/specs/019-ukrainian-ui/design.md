# 019 — Дизайн

## Підхід

Власний словник без бібліотек ([ADR-0016](../../decisions/0016-interface-in-two-languages.md)).

- `en.ts` — плаский об'єкт `ключ → текст`; він же визначає тип ключів. `uk.ts` має тип
  `Messages` (той самий набір ключів), тож пропущений чи зайвий ключ — помилка `tsc` (REQ-019-10).
- Текст — рядок з плейсхолдерами `{name}` або об'єкт множини `{ one, few, many, other }`; форму
  вибирає `Intl.PluralRules` поточної мови.
- `LanguageProvider` тримає мову в React-контексті й у `localStorage` (`vision.language`), ставить
  `<html lang>`; `useT()` повертає `t(key, params)`, `tx(key, nodes)` (текст з розміткою: жирна
  назва проєкту, приклад `<code>`), `formatDate`, `formatNumber`, `formatOrdinal`, `language`,
  `setLanguage`. Зміна мови — лише перерендер, без перезавантаження (REQ-019-02).
- Початкова мова: збережена; без неї — завжди `en`, мову браузера не дивимось: англійська —
  мова за замовчуванням для всіх (REQ-019-03, REQ-019-04).
- Відсутній у словнику текст → англійський текст, а якщо й його немає — сам ключ, ніколи не
  порожньо (REQ-019-11).
- Англійські тексти в словнику — дослівно ті, що були в коді, з помилками апстріму включно
  («Ignore carret»), щоб нічого не змінилося для англійської (REQ-019-08). Єдиний виняток — однина,
  якої раніше не було: «(1 check)» замість «(1 checks)».
- Дати — `formatDate` (для англійської ті самі частини, що `toLocaleString()` чи
  `toLocaleDateString()`), числа в текстах — `formatNumber` без розділювача тисяч (англійською
  «1080», як і було; українською «0,1»). Поля чисел лишаються `type="number"`: десятковий
  роздільник у них вводить браузер.
- Вбудовані тексти MUI (пагінація, «No options», таблиця `DataGrid`) — з `ukUA` пакета
  `@mui/x-data-grid/locales`: `createAppTheme(mode, language)` додає його до теми.
- Значення перелічень (статуси знімків і збірок, ролі, правила доступності) показує `labelOf`:
  ключ `testStatus.unresolved` тощо; англійською — те саме слово, що й було в інтерфейсі.
- Тексти даних (REQ-019-09) у словник не потрапляють: їх просто не обгортаємо в `t()`. Назви
  движків (`pixelmatch`, `odiff`…), типи задач Jira в прикладах (`Bug`, `Relates`) і шаблони в
  підказках класів проблем — дані.
- Чисті хелпери, які викликаються й поза React (`projectSettings.helper.ts`, `undo.helper.ts`,
  `device.helper.ts`, `describeChange`), приймають функцію `text` і за замовчуванням беруть
  англійську (`english`), тож їхні старі тести не змінились.
- Кроки екскурсії (`constants/help.ts`) тримають ключі, `GuidedTour` показує їхні тексти й
  перекладає кнопки Joyride. `RouteError` рендериться поза застосунком, тож має власний
  `LanguageProvider`.
  `SETTINGS_SECTIONS` тепер тримає ключі назв розділів і полів; `matchSettings` шукає за текстом
  вибраною мовою і англійською (REQ-019-12), `changedSections` повертає назви розділів вибраною
  мовою.

Перемикач — `SlidingToggleGroup` «EN | UK» у шапці поруч з кнопкою теми: шапка є на кожній
сторінці, зокрема на сторінці входу, а меню облікового запису до входу недоступне (REQ-019-01,
SC-019-03).

Перекладено всі екрани: каркас, вхід і реєстрація, список проєктів, налаштування проєкту, сторінка
збірки (список збірок, зміни й групи, таблиця й сітка знімків, фільтри, масові дії), перегляд
скриншота (панель доступності, змін і пристроїв, діалог бага Jira, схожі варіації), еталони та їхня
історія, Insights, профіль, користувачі, резервні копії, довідка, ручні перевірки, екскурсія,
порожні стани, помилки й сповіщення з Undo. Англійською лишаються дані (REQ-019-09), приклади
команд CLI і назви продуктів (Jira, Insights, SDK, CLI, MCP, VLM, AI).

## Глосарій перекладу

Один переклад на термін, скрізь у `uk.ts`; узгоджено зі [словником](../../product/glossary.md).
Множина — завжди через `Intl.PluralRules` (форми `one`, `few`, `many`, `other`).

| English | Українською | Як не перекладаємо |
|---|---|---|
| Baseline | еталон | «базова лінія» |
| Build | збірка | «білд» |
| Screenshot, test run, checkpoint | знімок | «скриншот», «тест-ран», «чекпоінт»: в інтерфейсі це одне зображення |
| Check | перевірка | |
| Variation | варіація | |
| Approve / Reject | прийняти / відхилити | «затвердити», «апрувнути» |
| Approved / Rejected | прийнято / відхилено | |
| Unresolved | чекає рішення | «невирішений» |
| New (status) | новий | |
| Failed | не пройшов (знімок), не пройшла (збірка) | «провалений» |
| Passed / ok | пройшла / без змін | |
| Diff | різниця; на панелі перегляду скорочено «Різн.» і «доп.», як «Diff» і «tol.» | «дифф» |
| Ignore area | ігнорована область | |
| Tolerance | допуск | |
| Element rule | правило елемента | |
| Accessibility issue (violation) | знахідка доступності | «порушення» |
| Accessibility problem | проблема доступності | |
| False positive | хибна знахідка | «фолс-позитив» |
| File a bug / link | завести баг / прив'язати | «створити тікет» |
| Change group | група змін | |
| Review | перегляд | «рев'ю» |
| Reference device | еталонний пристрій | |
| Hidden changes | невидимі зміни | |
| UI tree | UI-дерево | |
| Branch / main branch | гілка / основна гілка | «бранч» |
| Merge branches | об'єднати гілки | «змерджити» |
| Viewport | розмір екрана | |
| Custom tags | теги | |
| Backup | резервна копія | «бекап» |
| Fade (слайдер перегляду) | злиття | «прозорість» не вміщається в один рядок панелі |
| Status bar / navigation bar | рядок стану / панель навігації | «статус-бар» |
| Insights, Jira, SDK, CLI, MCP, VLM, AI | без перекладу | |

## Компоненти

| Компонент | Шлях | Роль |
|---|---|---|
| Словники | `frontend/src/i18n/en.ts`, `frontend/src/i18n/uk.ts` | тексти; `uk` має тип `Messages` |
| Чиста логіка | `frontend/src/i18n/translate.ts` | `translate`, множина, `initialLanguage`, `formatNumber`, `formatDate`, `formatOrdinal` |
| Словники разом | `frontend/src/i18n/dictionaries.ts` | `DICTIONARIES`, `english` для хелперів |
| Контекст | `frontend/src/i18n/LanguageProvider.tsx` | мова, `localStorage`, `<html lang>`, `useT()` |
| Перемикач | `frontend/src/i18n/LanguageSwitch.tsx` | EN / UK у шапці |
| Шапка | `frontend/src/components/Header.tsx` | перемикач, меню й підписи через `t()` |
| Пошук налаштувань | `frontend/src/_helpers/projectSettings.helper.ts` | ключі розділів, пошук двома мовами |
| Сторінка налаштувань | `frontend/src/pages/ProjectSettingsPage.tsx`, `frontend/src/components/ProjectForm/` | розділи, панель збереження, діалоги |
| Список проєктів | `frontend/src/pages/ProjectListPage.tsx` | таблиця, створення й видалення |
| Решта екранів | `frontend/src/pages/`, `frontend/src/components/` | тексти через `useT()` |
| Тексти MUI | `frontend/src/theme.ts` | `createAppTheme(mode, language)` з `ukUA` |

## Дані

База не змінюється. `localStorage["vision.language"]` = `en` | `uk`.

## Ризики

| Ризик | Що робимо |
|---|---|
| Довші українські тексти ламають верстку | скриншот-тести українською: список проєктів, збірка, перегляд (і в темній темі), налаштування, еталони та їхня історія |
| Злиття з апстрімом у перекладених компонентах | ключі називаємо за компонентом (`projectList.*`), нові тексти апстріму переносимо при злитті |
| Плейсхолдер перекладено чи загублено | unit-тест: множини `{…}` в обох мовах однакові |
| Пошук налаштувань перестав знаходити англійські назви | `matchSettings` порівнює і з англійським текстом; unit-тест |

## Ручна перевірка (2026-10-29)

Обидві `manual:` перевірки нижче пройдено в браузері (Chromium через Playwright, macOS) на моках
API з функціонального набору: увесь набір прогнано з увімкненою українською, і після кожного з
189 тестів знято сторінку й її текст — 179 станів екранів: вхід і реєстрація, список проєктів,
налаштування (усі розділи), сторінка збірки (зміни, групи, таблиця, сітка, доступність, масові
дії, помилки завантаження), перегляд скриншота (усі вкладки, діалоги Jira, хибної знахідки,
правила елемента, схожих варіацій, пристроїв), еталони та історія, Insights, профіль,
користувачі, резервні копії й Google Drive, меню довідки, ручні перевірки, екскурсія, ролі.

- REQ-019-05: англійські слова на знімках — лише дані тестів (назви, id, гілки, email) і назви
  продуктів. Знайдено й виправлено: рядок збірки в списку («changed · passed», дата в
  англійському форматі), позначку допуску «tol.», дату останнього входу, відсотки «12.5%»,
  рівень знахідки (WARNING/ERROR).
- REQ-019-09: назви проєктів, перевірок, гілок, id елементів, тексти правил і знахідок від
  сервера, повідомлення сервера й мережі («Failed to fetch», «User already exists») показуються
  як є.
- Верстка: обрізались і виправлені — третя вкладка панелі перегляду (довга плашка «нових: 2»),
  зміст сторінки налаштувань (назви розділів зі статусом), підпис пошуку налаштувань, поля
  розкладу резервних копій, прапорець «далі після рішення». Темна тема — скриншот-тест перегляду
  українською.
- Друга ітерація (виміряно в браузері на 1280 px): панель інструментів перегляду вміщається в
  один рядок («Різн.», «доп.», «Злиття», «Ігнорування», «Коментар»); колонка «Статус» має
  `minWidth: 140`, тож плашка «чекає рішення» не обрізається; плейсхолдер пошуку налаштувань
  «Пошук» (підпис для читача екрана — «Пошук налаштувань»); різниця й допуск — одне правило
  форматування (до двох знаків, десятковий знак мови).

## Перевірка вимог

| Вимога | Перевірка |
|---|---|
| REQ-019-01 | `frontend/src/i18n/LanguageSwitch.test.tsx › offers English and Ukrainian`; `frontend/integration_tests/test/language.spec.ts › offers the language switch on the login page` |
| REQ-019-02 | `frontend/src/i18n/LanguageSwitch.test.tsx › switches the texts without a reload` |
| REQ-019-03 | `frontend/integration_tests/test/language.spec.ts › switches the header and the page to Ukrainian and keeps it after a reload` |
| REQ-019-04 | `frontend/src/i18n/translate.test.ts › starts in English until someone picks Ukrainian` |
| REQ-019-05 | `frontend/integration_tests/test/language.spec.ts › shows the project settings in Ukrainian`; `frontend/integration_tests/test/projec.spec.ts › renders the build and the review in Ukrainian`; manual: вибрати «Українська» й пройти всі сторінки; англійськими лишаються лише дані |
| REQ-019-06 | `frontend/src/i18n/translate.test.ts › formats numbers and dates the Ukrainian way` |
| REQ-019-07 | `frontend/src/i18n/LanguageSwitch.test.tsx › marks the document with the language` |
| REQ-019-08 | `frontend/integration_tests/test/projectList.spec.ts › renders` |
| REQ-019-09 | manual: українською назви проєктів, id елементів і повідомлення сервера показуються як є |
| REQ-019-10 | `frontend/src/i18n/translate.test.ts › has every text in both languages with the same placeholders` |
| REQ-019-11 | `frontend/src/i18n/translate.test.ts › falls back to English for a text it has no translation of` |
| REQ-019-12 | `frontend/src/_helpers/projectSettings.helper.test.ts › finds a setting by its Ukrainian or English name` |
