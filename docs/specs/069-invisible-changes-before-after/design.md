# 069 — Дизайн

## Підхід

Лише фронтенд; бекенд уже віддає `structure.invisible` (підмножину `structure.changes`), і цього
досить. Невидима зміна не перетинає жодної зміненої ділянки (`invisibleChanges` у
`backend/src/ui-tree/screen-checks.ts`), тож `changeRows` завжди дає їй власний рядок —
окремий блок лише повторював ці рядки.

- **Порівняння по словах** — чиста функція `wordDiff(before, after)`: ділить обидва тексти за
  пробілами (пробіли зберігає), знаходить найдовшу спільну послідовність слів і повертає два
  списки шматків `{ text, changed }`. Тексти підписів короткі (десятки слів), тож O(n·m) досить.
- **`BeforeAfter`** — маленький компонент: сітка «Було / Стало» з двох рядків, змінені слова
  на `tokens.status.failed.bg` (було, закреслено) і `tokens.status.passed.bg` (стало). Порожній
  бік — «—». Текст переноситься, не обрізається (REQ-069-04).
- **`InsightsPanel`**: `whatChanged` для `text`/`label` і для єдиного місця з «було → стало»
  повертає `BeforeAfter` замість рядка `changes.text`/`changes.label`/`changes.placeChanged`.
  Червоний `Alert` з `panel.invisible` замінено смужкою `invisibleStrip` (колір
  `tokens.status.changed`, значок `VisibilityOff`) з кількістю, а рядки, чия `change` є в
  `structure.invisible` (ключ `kind:key`), отримують той самий значок у колонці перед назвою
  (`invisibleMark`), але лише коли в переліку є й видимі зміни (REQ-069-10).
- **`WhatsCompared`**: прибрано нижній рядок з `compared.selectHelp`, «Обрати елементи» і меню
  «Ще дії»/«Правило вручну», разом із пропсами `onSelectElements`/`onAddRule`. Форма правила
  лишається в діях елемента (`openRule(resourceId, …)`), вибір — на панелі інструментів і E.
- **i18n**: нові `panel.invisibleCount` (множина), `changes.before`, `changes.after`; змінено
  `select.variableClick` (uk); прибрано невживані `panel.invisible`, `compared.selectHelp`,
  `compared.manualRule`, `compared.moreActions`.

## Компоненти

| Компонент | Шлях | Роль |
|---|---|---|
| Порівняння по словах | `frontend/src/_helpers/wordDiff.helper.ts` | `wordDiff(before, after)` → шматки «було» і «стало» з позначкою зміни |
| Було / Стало | `frontend/src/components/TestDetailsDialog/BeforeAfter.tsx` | два вирівняні рядки з виділеними словами |
| Перелік змін | `frontend/src/components/TestDetailsDialog/InsightsPanel.tsx` | смужка замість блоку, позначка рядка, «Було / Стало» в рядку |
| Межі порівняння | `frontend/src/components/TestDetailsDialog/WhatsCompared.tsx` | без рядка «Обрати елементи» і «Правило вручну» |
| Словники | `frontend/src/i18n/en.ts`, `uk.ts` | ключі вище |

## Дані

Без змін у базі й API.

## Ризики

| Ризик | Що робимо |
|---|---|
| Хтось звик до «Правило вручну» без елемента | Власник вирішив прибрати; правило для елемента відкривається з дій елемента |
| Довгий текст робить рядок високим | Переноситься; таких підписів мало, а читабельність важливіша |

## Перевірка вимог

| Вимога | Перевірка |
|---|---|
| REQ-069-01 | `frontend/integration_tests/test/elementRules.spec.ts › shows a change the pixels miss once, as before and after` |
| REQ-069-02 | `frontend/integration_tests/test/elementRules.spec.ts › shows a change the pixels miss once, as before and after` |
| REQ-069-03 | `frontend/integration_tests/test/elementRules.spec.ts › shows a change the pixels miss once, as before and after` |
| REQ-069-04 | `frontend/integration_tests/test/elementRules.spec.ts › says the count once and lists the changes straight under it` |
| REQ-069-05 | `frontend/src/_helpers/wordDiff.helper.test.ts › marks only the words that differ` |
| REQ-069-06 | `frontend/integration_tests/test/elementRules.spec.ts › shows a change the pixels miss once, as before and after` |
| REQ-069-07 | `frontend/integration_tests/test/elementSelection.spec.ts › leaves element selection to the toolbar, not the Changes tab` |
| REQ-069-08 | `frontend/integration_tests/test/elementSelection.spec.ts › leaves element selection to the toolbar, not the Changes tab` |
| REQ-069-09 | `frontend/src/i18n/translate.test.ts › asks to press, not click, the part of a text that changes` |
| REQ-069-10 | `frontend/integration_tests/test/elementRules.spec.ts › marks no row when the pixels miss every change` |
| REQ-069-11 | `frontend/integration_tests/test/testDetailsDialog.spec.ts › keeps the review layout and its keys`; `frontend/integration_tests/test/elementRules.spec.ts › says the count once and lists the changes straight under it` |
