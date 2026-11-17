# 072 — Дизайн

## Підхід

- **Пара на еталоні (REQ-072-01, 03).** Нова чиста `variableNodes(rule, current, baseline)` у
  `comparison-inputs.ts`: на знімку — `ruleNodes` (070), на еталоні — двійник кожного з них серед
  усіх вузлів за селектором з тим самим `key` (як у `diffTrees`), плюс вузли еталона, які бере
  `ruleNodes` і які не мають пари (зниклий рядок, «Елемента немає» з 033). `resolveRules` і `locateCandidates`
  беруть вузли правила `variable` з неї; далі `leftOutOf` уже пара за `key`.
- **Місце на еталоні (REQ-072-02).** Коли текст еталона не проходить перевірку, `locateCandidates`
  бере місця з чистої `alignPlaces(text, places, otherText)` у `text-locate.ts`: слова обох текстів
  вирівнюються найдовшою спільною послідовністю; місце — слова еталона між тими самими спільними
  словами, слово в слово, коли їх порівну, або всі, коли між ними лише місце. Інакше `null` —
  увесь елемент (071).
- **Попередження (REQ-072-04…06).** `otherDiffers(parts, text, otherText)` у
  `variableText.helper.ts` тим самим вирівнюванням знаходить ділянки, що відрізняються: якщо в
  ділянці є непозначені слова — їх слова з іншого знімка (до трьох), якщо лише позначені й інший
  текст не проходить перевірку — значення. Двійник на іншому знімку в `TestDetailsModal.otherText`
  — елемент з тим самим селектором на тому самому порядковому місці.
- **Без рамки (REQ-072-07).** `leftOutMarks` повертає лише штриховку; підпис правила — на першій
  штриховці елемента.

## Компоненти

| Компонент | Шлях | Роль |
|---|---|---|
| `variableNodes`, `resolveRules`, `locateCandidates` | `backend/src/ui-tree/comparison-inputs.ts` | пара за `key`, місця на еталоні |
| `alignPlaces` | `backend/src/ui-tree/text-locate.ts` | місця в тексті з іншими незмінними словами |
| `otherDiffers`, `leftOutMarks` | `frontend/src/_helpers/variableText.helper.ts` | попередження, штриховка без рамки |
| `otherText`, позначки | `frontend/src/components/TestDetailsDialog/TestDetailsModal.tsx` | той самий рядок, підпис на першій штриховці |
| попередження | `frontend/src/components/TestDetailsDialog/ElementPopover.tsx`, `i18n/en.ts`, `uk.ts` | нові тексти |

## Дані

Без змін.

## Ризики

| Ризик | Що робимо |
|---|---|
| Список зсунувся, і на місці рядка інший рядок | місце не визначиться (усі слова інші) → увесь елемент, як досі |
| Вирівнювання обере не ті слова при повторах | місце між спільними словами; неоднозначне — увесь елемент |

## Перевірка вимог

| Вимога | Перевірка |
|---|---|
| REQ-072-01 | `backend/src/ui-tree/comparison-inputs.spec.ts › pairs a row with the same row of the baseline even when its fixed words differ` |
| REQ-072-02 | `backend/src/ui-tree/text-locate.spec.ts › finds a place of the snapshot on a baseline whose unmarked words differ` |
| REQ-072-03 | `backend/src/ui-tree/comparison-inputs.spec.ts › compares the unmarked words of the row once the place is found` |
| REQ-072-04 | `frontend/src/components/TestDetailsDialog/ElementPopover.test.tsx › names the baseline words that differ where nothing is marked` |
| REQ-072-05 | `frontend/src/_helpers/variableText.helper.test.ts › tells a marked value of another kind on the other text` |
| REQ-072-06 | `manual: на екрані історії обрати третій рядок → «Нестабільний текст» → попередження називає слова третього рядка еталона, а не першого` |
| REQ-072-07 | `frontend/src/_helpers/variableText.helper.test.ts › marks the text parts hatched, with no frame round the element` |
