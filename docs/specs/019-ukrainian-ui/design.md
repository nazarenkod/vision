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
- Початкова мова: збережена, інакше `navigator.languages[0]` починається з `uk` → `uk`, інакше
  `en` (REQ-019-03, REQ-019-04).
- Відсутній у словнику текст → англійський текст, а якщо й його немає — сам ключ, ніколи не
  порожньо (REQ-019-11).
- Англійські тексти в словнику — дослівно ті, що були в коді, з помилками апстріму включно
  («Ignore carret»), щоб нічого не змінилося для англійської (REQ-019-08). Єдиний виняток — однина,
  якої раніше не було: «(1 check)» замість «(1 checks)».
- Дата створення в списку проєктів — `formatDate` (для англійської ті самі частини, що
  `toLocaleString()`). Поля чисел лишаються `type="number"`: десятковий роздільник у них вводить
  браузер.
- Тексти даних (REQ-019-09) у словник не потрапляють: їх просто не обгортаємо в `t()`. Назви
  движків (`pixelmatch`, `odiff`…), типи задач Jira в прикладах (`Bug`, `Relates`) і шаблони в
  підказках класів проблем — дані.
- Чисті хелпери, які викликаються й поза React (`projectSettings.helper.ts`), приймають функцію
  `text` і за замовчуванням беруть англійську (`english`), тож їхні старі тести не змінились.
  `SETTINGS_SECTIONS` тепер тримає ключі назв розділів і полів; `matchSettings` шукає за текстом
  вибраною мовою і англійською (REQ-019-12), `changedSections` повертає назви розділів вибраною
  мовою.

Перемикач — `SlidingToggleGroup` «EN | UK» у шапці поруч з кнопкою теми: шапка є на кожній
сторінці, зокрема на сторінці входу, а меню облікового запису до входу недоступне (REQ-019-01,
SC-019-03).

Переклад іде екранами. Перший етап — каркас (шапка, бічна панель, кнопка закриття сповіщень,
«Cancel» спільного `BaseModal`), перемикач, список проєктів і сторінка налаштувань проєкту
(розділи з `components/ProjectForm/*`). Решта екранів — наступними комітами; специфікація стає
`Implemented`, коли в `src` не лишиться текстів поза словником (SC-019-01).

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

## Дані

База не змінюється. `localStorage["vision.language"]` = `en` | `uk`.

## Ризики

| Ризик | Що робимо |
|---|---|
| Довші українські тексти ламають верстку | скриншот-тест списку проєктів українською |
| Злиття з апстрімом у перекладених компонентах | ключі називаємо за компонентом (`projectList.*`), нові тексти апстріму переносимо при злитті |
| Плейсхолдер перекладено чи загублено | unit-тест: множини `{…}` в обох мовах однакові |
| Пошук налаштувань перестав знаходити англійські назви | `matchSettings` порівнює і з англійським текстом; unit-тест |

## Перевірка вимог

| Вимога | Перевірка |
|---|---|
| REQ-019-01 | `frontend/src/i18n/LanguageSwitch.test.tsx › offers English and Ukrainian`; `frontend/integration_tests/test/language.spec.ts › offers the language switch on the login page` |
| REQ-019-02 | `frontend/src/i18n/LanguageSwitch.test.tsx › switches the texts without a reload` |
| REQ-019-03 | `frontend/integration_tests/test/language.spec.ts › switches the header and the page to Ukrainian and keeps it after a reload` |
| REQ-019-04 | `frontend/src/i18n/translate.test.ts › starts in Ukrainian only for a Ukrainian browser` |
| REQ-019-05 | `frontend/integration_tests/test/language.spec.ts › shows the project settings in Ukrainian`; manual: вибрати «Українська» й пройти всі сторінки; англійськими лишаються лише дані |
| REQ-019-06 | `frontend/src/i18n/translate.test.ts › formats numbers and dates the Ukrainian way` |
| REQ-019-07 | `frontend/src/i18n/LanguageSwitch.test.tsx › marks the document with the language` |
| REQ-019-08 | `frontend/integration_tests/test/projectList.spec.ts › renders` |
| REQ-019-09 | manual: українською назви проєктів, id елементів і повідомлення сервера показуються як є |
| REQ-019-10 | `frontend/src/i18n/translate.test.ts › has every text in both languages with the same placeholders` |
| REQ-019-11 | `frontend/src/i18n/translate.test.ts › falls back to English for a text it has no translation of` |
| REQ-019-12 | `frontend/src/_helpers/projectSettings.helper.test.ts › finds a setting by its Ukrainian or English name` |
