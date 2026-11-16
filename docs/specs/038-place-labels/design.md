# 038 — Дизайн

Специфікація: [spec.md](spec.md).

## Підхід

Лише фронтенд. Відповідь `structure` уже несе дерева обох знімків як `elements` і
`baselineElements` (рамки в пікселях знімка, текст). Чиста `placeLabel(place, rowElement,
elements, baselineElements)` у `changedAreas.ts` бере найменший елемент під центром місця тим
самим `elementAt`, що й вибір елементів кліком, і шукає в еталоні елемент із тим самим
селектором і найближчою рамкою. Якщо знайдено лише сам елемент рядка або нічого — `null`, і
панель пише «ділянка W × H px». `whereOn` і ключі `changes.where.*` прибрано; з `changeRows`
прибрано `nth`/`of` і ключ `changes.nth`.

## Компоненти

| Компонент | Шлях | Роль |
|---|---|---|
| Підпис місця | `frontend/src/components/TestDetailsDialog/changedAreas.ts` | `placeLabel`; `changeRows` без номерів (REQ-038-01…03, 05). |
| Перелік змін | `frontend/src/components/TestDetailsDialog/InsightsPanel.tsx` | Підпис місця, обрізаний до 40 символів із повним у підказці; одне місце з «було → стало» — замість «Змінено в 1 місці» (REQ-038-01…04). |
| Тексти | `frontend/src/i18n/en.ts`, `frontend/src/i18n/uk.ts` | `changes.placeArea`, `changes.placeText`, `changes.placeChanged`. |

## Дані

Без змін.

## Ризики

| Ризик | Що робимо |
|---|---|
| Рамки дерева й пікселі знімка в різних одиницях (iOS). | `elements` уже в пікселях знімка: на них же працює вибір елементів кліком. |
| Найменший елемент під центром — контейнер без тексту. | Тоді підпис — його назва чи тип; якщо це сам елемент рядка — розмір ділянки. |

## Перевірка вимог

| Вимога | Перевірка |
|---|---|
| REQ-038-01 | `frontend/src/components/TestDetailsDialog/changedAreas.test.ts › names a place without text by the element's type` |
| REQ-038-02 | `frontend/src/components/TestDetailsDialog/changedAreas.test.ts › says what the text was and is when it changed` |
| REQ-038-03 | `frontend/src/components/TestDetailsDialog/changedAreas.test.ts › leaves a place on the row's own element, or with no tree, to its size` |
| REQ-038-04 | `frontend/integration_tests/test/elementRules.spec.ts › names a changed place by the text in it, as it was and is` |
| REQ-038-05 | `frontend/src/components/TestDetailsDialog/changedAreas.test.ts › leaves rows with the same name unnumbered` |
