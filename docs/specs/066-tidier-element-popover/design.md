# 066 — Дизайн

## Підхід

Лише фронтенд. Попап (`ElementPopover`) отримує від `TestDetailsModal` функцію `elementRect` —
межі елемента у вікні (той самий `onScreen`, що й для інших позначок) — і ставить Popper
`right-start` з запасними `left-start`, `bottom`, `top`. Якір перераховується, коли змінюються
межі елемента (крок ↑ / ↓).

Закриття — `ClickAwayListener` на `mousedown`, як у меню Areas (спец. 024). Кліки всередині
`.konvajs-content` (знімки) пропускаються: там вирішує `pick` (клік на знімку не по елементу, спец. 024), інакше клік по іншому
елементу спершу закрив би попап.

Довгу опору скорочує чиста `shortAnchor` у `elementPicking.helper.ts`.

## Компоненти

| Компонент | Шлях | Роль |
|---|---|---|
| `ElementPopover` | `frontend/src/components/TestDetailsDialog/ElementPopover.tsx` | розташування, заголовок, варіанти, обсяг над діями, тихий рядок «Додати ще», закриття кліком поза |
| `elementRect` | `frontend/src/components/TestDetailsDialog/TestDetailsModal.tsx` | межі обраного елемента у вікні |
| `shortAnchor` | `frontend/src/_helpers/elementPicking.helper.ts` | скорочення посередині |
| `select.relation.*` | `frontend/src/i18n/uk.ts` | нові слова зв'язку |

## Перевірка вимог

| Вимога | Перевірка |
|---|---|
| REQ-066-01 | `frontend/integration_tests/test/elementSelection.spec.ts › puts the actions away on a click outside them and leaves the element in view` |
| REQ-066-02 | `frontend/src/components/TestDetailsDialog/ElementPopover.test.tsx › names a nameless element by its class once the ways to find it are listed` |
| REQ-066-03 | `frontend/src/_helpers/elementPicking.helper.test.ts › cuts a long anchor in the middle, keeping its start and end` |
| REQ-066-04 | `frontend/src/components/TestDetailsDialog/ElementPopover.test.tsx › counts only the ways that find other than one element` |
| REQ-066-05 | `frontend/src/components/TestDetailsDialog/ElementPopover.test.tsx › keeps the step down in place, disabled when there is nowhere to go` |
| REQ-066-06 | `frontend/src/components/TestDetailsDialog/ElementPopover.test.tsx › asks where the rule goes before what it does` |
| REQ-066-07 | `frontend/integration_tests/test/elementSelection.spec.ts › offers to add more elements next to one` |
| REQ-066-08 | `frontend/src/components/TestDetailsDialog/ElementPopover.test.tsx › closes on a click outside it` |
| REQ-066-09 | manual: українські слова зв'язку в попапі переглянуто; `tsc` перевіряє, що ключ є в обох мовах |
