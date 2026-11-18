# 077 — Дизайн

## Підхід

- **Пара за місцем (REQ-077-01, 04, 05).** Нова чиста `pairsByPlace(baseline, current)` у
  `structure-diff.ts`. Вона бере елементи без `resourceId` із текстом чи підписом, яким немає пари за
  `key`. Місце елемента — `key` батька, клас і порядковий номер серед дітей батька того самого
  класу (`placesOf`). Місце визначене, лише коли батько має пару за `key` на іншому дереві
  (REQ-077-05). `diffTrees` бере двійника з цієї пари, коли немає пари за `key`. Тоді зміна йде
  звичайним шляхом (`text`/`label`, розмір, зсув) під `key` знімка, а зниклим двійник еталона
  не вважається. Ключі вузлів не змінюються (REQ-077-04).
- **«Лише числа» (REQ-077-03).** Чиста `onlyNumbersDiffer(before, after)` у новому
  `number-change.ts`. Тексти діляться на шматки тим самим виразом, що й у позначенні
  нестабільного тексту (033), але «+» одразу після числа належить до числа («99+»). Слово
  одразу після зміненого числа може відрізнятися не більше ніж 2 останніми літерами, а спільна
  основа — щонайменше 3 літери.
- **Рядок «було → стало» (REQ-077-02).** На фронтенді нічого не змінюється: зміна виду
  `text`/`label` уже показується `BeforeAfter` (074).
- **Підказка (REQ-077-06, 07).** Чиста `numbersOnlyHint(changes, regions, tree)` у
  `noise-hints.ts`. Підказка виду `numbers` з'являється, коли кожна зміна після правил — `text`
  чи `label` лише в числах, або зсув чи зміна розміру того самого елемента, а кожна змінена
  ділянка лежить на одному з цих елементів. `findNoiseHints` отримує `changes` від
  `UiTreeService.structure`. Підказку `numbers` вона дає і без змінених пікселів (число в
  підписі), а підказку `dynamic-text` для тих самих елементів тоді не дає. Текст підказки
  перекладає фронтенд (`changes.numbersOnly`). `message` з сервера лишається англійським, як в
  інших підказок.
- **Дія (REQ-077-08, 09).** `InsightsPanel` показує під підказкою кожен елемент через
  `BeforeAfter` і кнопку «Нестабільний текст» (`select.variable`), а «Ігнорувати» не показує.
  `TestDetailsModal.markNumbers` обирає елемент знімка за `index`, а `changedNumbers` (у
  `variableText.helper.ts`) дає номери шматків, де число відрізняється від еталона. Поле
  `premarked` у виборі передається в `ElementPopover.startMarked`, і поповер відкривається в
  режимі позначення з ними. Зберігає правило, як і досі, лише «Зберегти» чи Enter.

## Компоненти

| Компонент | Шлях | Роль |
|---|---|---|
| `onlyNumbersDiffer` | `backend/src/ui-tree/number-change.ts` | тексти відрізняються лише числами |
| `pairsByPlace`, `diffTrees` | `backend/src/ui-tree/structure-diff.ts` | пара за місцем у дереві |
| `numbersOnlyHint`, `findNoiseHints` | `backend/src/ui-tree/noise-hints.ts` | підказка виду `numbers` з елементами |
| `structure` | `backend/src/ui-tree/ui-tree.service.ts` | передає зміни в підказки |
| `NoiseHint`, `NumberChange` | `frontend/src/types/insights.ts` | тип підказки |
| підказка й кнопка | `frontend/src/components/TestDetailsDialog/InsightsPanel.tsx` | REQ-077-07, 08 |
| `markNumbers` | `frontend/src/components/TestDetailsDialog/TestDetailsModal.tsx` | відкриває поповер з позначками |
| `startMarked` | `frontend/src/components/TestDetailsDialog/ElementPopover.tsx` | позначені шматки на старті |
| `changedNumbers` | `frontend/src/_helpers/variableText.helper.ts` | які шматки позначити |
| словники | `frontend/src/i18n/en.ts`, `uk.ts` | `changes.numbersOnly` (REQ-077-10) |

## Дані

Без змін: зміни й підказки рахуються на запит з дерев, які вже збережено.

## Ризики

| Ризик | Що робимо |
|---|---|
| Список зсунувся, і на місці рядка стоїть інший рядок | пара лише тоді, коли тексти відрізняються самими числами; інші рядки лишаються «З'явився» / «Зник» |
| Два рядки однакового вигляду з різними сумами помінялися місцями | зіставиться за місцем: дві зміни сум замість «З'явився» / «Зник». Чесно для порівняння на тому самому місці |
| Число в підписі без пікселів стає прихованою зміною (002), бо `label` рахується, а незклікабельне «з'явився» / «зникло» — ні | так само, як для елемента з id; підказка про числа показує, що це дані |
| Позначка з підказки для «99+» → «49» ставиться лише на «49» (033 ділить «99+» на два шматки) | граничний випадок специфікації: наступне «99+» перевірка не пропустить, і QA позначить «+» сам |

## Перевірка вимог

| Вимога | Перевірка |
|---|---|
| REQ-077-01 | `backend/src/ui-tree/number-change.spec.ts › shows an element without an id whose number changed as one text change, not appeared and gone` |
| REQ-077-02 | `backend/src/ui-tree/number-change.spec.ts › leaves appeared and gone when the words changed, not the numbers` |
| REQ-077-03 | `backend/src/ui-tree/number-change.spec.ts › tells numbers changing inside a sentence, with the word after them in another form` |
| REQ-077-04 | `backend/src/ui-tree/number-change.spec.ts › keeps the element's own key on a paired change` |
| REQ-077-05 | `backend/src/ui-tree/number-change.spec.ts › pairs nothing when two look-alikes on the baseline could be either` |
| REQ-077-06 | `backend/src/ui-tree/number-change.spec.ts › says nothing about numbers when something else changed too` |
| REQ-077-07 | `frontend/integration_tests/test/numbersHint.spec.ts › says only numbers changed and offers variable text, not Ignore` |
| REQ-077-08 | `frontend/integration_tests/test/numbersHint.spec.ts › shows the hint with no variable text to someone who cannot change rules` |
| REQ-077-09 | `frontend/integration_tests/test/numbersHint.spec.ts › opens the element's variable text with the changed numbers marked` |
| REQ-077-10 | manual: `npx tsc --noEmit -p .` у `frontend` — пропущений переклад нового ключа є помилкою типів |
