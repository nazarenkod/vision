# 018 — Дизайн

## Підхід

Власний словник без бібліотек ([ADR-0014](../../decisions/0014-interface-in-two-languages.md)).

- `en.ts` — плаский об'єкт `ключ → текст`; він же визначає тип ключів. `uk.ts` має тип
  `Messages` (той самий набір ключів), тож пропущений чи зайвий ключ — помилка `tsc` (REQ-018-10).
- Текст — рядок з плейсхолдерами `{name}` або об'єкт множини `{ one, few, many, other }`; форму
  вибирає `Intl.PluralRules` поточної мови.
- `LanguageProvider` тримає мову в React-контексті й у `localStorage` (`vision.language`), ставить
  `<html lang>`; `useT()` повертає `t(key, params)`, `formatDate`, `formatNumber`, `language`,
  `setLanguage`. Зміна мови — лише перерендер, без перезавантаження (REQ-018-02).
- Початкова мова: збережена, інакше `navigator.languages[0]` починається з `uk` → `uk`, інакше
  `en` (REQ-018-03, REQ-018-04).
- Відсутній у словнику текст (ключ з даних, що прийшов у рантаймі) → англійський текст, а якщо
  й його немає — сам ключ не показуємо, а повертаємо англійський (REQ-018-11).
- Числа: поля вводу приймають кому й крапку (`parseLocaleNumber`).
- Тексти даних (REQ-018-09) у словник не потрапляють: їх просто не обгортаємо в `t()`.

Переклад іде екранами. Перший етап — каркас, перемикач у шапці й на сторінці входу, список
проєктів і сторінка налаштувань ([019](../019-project-settings-page/spec.md)). Решта екранів —
наступними комітами; специфікація стає `Implemented`, коли в `src` не лишиться текстів поза
словником (SC-018-01).

## Компоненти

| Компонент | Шлях | Роль |
|---|---|---|
| Словники | `frontend/src/i18n/en.ts`, `frontend/src/i18n/uk.ts` | тексти; `uk` має тип `Messages` |
| Чиста логіка | `frontend/src/i18n/translate.ts` | `translate`, множина, `initialLanguage`, `parseLocaleNumber` |
| Контекст | `frontend/src/i18n/LanguageProvider.tsx` | мова, `localStorage`, `<html lang>`, `useT()` |
| Перемикач | `frontend/src/i18n/LanguageSwitch.tsx` | EN / UK у шапці й на сторінці входу |

## Дані

База не змінюється. `localStorage["vision.language"]` = `en` | `uk`.

## Ризики

| Ризик | Що робимо |
|---|---|
| Довші українські тексти ламають верстку | скриншот-тест сторінки налаштувань українською |
| Злиття з апстрімом у перекладених компонентах | ключі називаємо за компонентом (`projectList.*`), нові тексти апстріму переносимо при злитті |
| Плейсхолдер перекладено чи загублено | unit-тест: множини `{…}` в обох мовах однакові |

## Перевірка вимог

| Вимога | Перевірка |
|---|---|
| REQ-018-01 | `frontend/src/i18n/LanguageSwitch.test.tsx › offers English and Ukrainian` |
| REQ-018-02 | `frontend/src/i18n/LanguageSwitch.test.tsx › switches the texts without a reload` |
| REQ-018-03 | `frontend/src/i18n/LanguageSwitch.test.tsx › remembers the language in the browser` |
| REQ-018-04 | `frontend/src/i18n/translate.test.ts › starts in Ukrainian only for a Ukrainian browser` |
| REQ-018-05 | manual: вибрати «Українська» й пройти всі сторінки; англійськими лишаються лише дані |
| REQ-018-06 | `frontend/src/i18n/translate.test.ts › formats numbers and dates the Ukrainian way` |
| REQ-018-07 | `frontend/src/i18n/LanguageSwitch.test.tsx › marks the document with the language` |
| REQ-018-08 | `frontend/integration_tests/test/projectList.spec.ts › renders` |
| REQ-018-09 | manual: українською назви проєктів, id елементів і повідомлення сервера показуються як є |
| REQ-018-10 | `frontend/src/i18n/translate.test.ts › has every text in both languages with the same placeholders` |
| REQ-018-11 | `frontend/src/i18n/translate.test.ts › falls back to English for a text it has no translation of` |
