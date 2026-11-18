# 079 — Дизайн

## Підхід

- **Межі зсуву (REQ-079-01, REQ-079-02).** Компенсація зсувів ([002](../002-ui-tree-analysis/spec.md))
  уже знає межі елемента на еталоні (`from`, пікселі дерева еталона) і на знімку
  (`to`, пікселі знімка). `UiTreeService` віддає їх у кожному записі `structure.moves` разом з
  `dxDp`/`dyDp`. Відповідь `structure` рахується під час запиту, тож межі мають і старі прогони.
- **Назва безіменного (REQ-079-09…11).** Чиста функція `textsInside(tree, node)` у
  `ui-tree.parser.ts` повертає до двох перших власних текстів нащадків у порядку вузлів дерева,
  розкодованих і обрізаних до 24 символів (23 + «…»). Вона викликається лише для елемента без id і
  без власного тексту. Сервер кладе результат у `moves[].around`, а слово «навколо» / «ancestor
  of» додає інтерфейс зі словника (ADR-0017): так назва не залежить від мови сервера.
- **Рядок і підсвітка (REQ-079-03…08).** У `InsightsPanel` кожен зсув стає рядком-кнопкою з
  `data-testid="movedElement"`. Наведення й фокус ставлять `previewMark` (`move:<key>`), а клік
  перемикає `pinnedMark`, як рядок області з тесту у `WhatsCompared`. `TestDetailsModal` малює
  позначки чистою `moveMarks` з `_helpers/moves.helper.ts`: показується зсув із `previewMark`, якщо
  це зсув, а інакше закріплений. На еталоні — пунктир «було» в межах `from`. На поточному —
  суцільна рамка зі стрілкою й відстанню в межах `to`. В одному знімку («Накладання»,
  «Прозорість») обидві позначки малюються на ньому. Закріплення вже скидається при зміні
  `testRun.id`. Esc знімає закріплений зсув слухачем у фазі перехоплення, як Esc у виборі
  елементів ([024](../024-elements-instead-of-areas/spec.md)), тож рев'ю при цьому не закривається.
- **Текст (REQ-079-12).** Речення `panel.movedHelp` прибрано, а напрямок і відстань стоять
  окремим рядком під назвою (`movedBy` у тому ж хелпері).

## Компоненти

| Компонент | Шлях | Роль |
|---|---|---|
| `textsInside` | `backend/src/ui-tree/ui-tree.parser.ts` | тексти всередині безіменного елемента |
| `structure.moves` | `backend/src/ui-tree/ui-tree.service.ts` | `from`, `to`, `around` у кожному зсуві |
| тип `moves` | `frontend/src/types/insights.ts` | дзеркало відповіді |
| `moveMarkId`, `shownMove`, `moveMarks`, `moveName`, `movedBy` | `frontend/src/_helpers/moves.helper.ts` | чиста логіка рядка й позначок |
| рядок зсуву | `frontend/src/components/TestDetailsDialog/InsightsPanel.tsx` | наведення, фокус, клік |
| позначки, Esc | `frontend/src/components/TestDetailsDialog/TestDetailsModal.tsx` | малювання на знімках |
| словники | `frontend/src/i18n/en.ts`, `uk.ts` | `panel.movedAround`, `panel.movedWas`; без `panel.movedHelp` |

## Дані

Без змін у базі. У відповіді `structure` кожен запис `moves` отримує поля `from`, `to` (пікселі)
і, для безіменного елемента з текстами всередині, `around` (до двох рядків). Поля лише
додаються: старий клієнт їх не читає.

## Ризики

| Ризик | Що робимо |
|---|---|
| Еталон іншої роздільності: межі `from` не збігаються з картинкою | `from` — у пікселях дерева еталона, тобто його знімка; кожна позначка малюється на своєму знімку |
| Esc одночасно знімає закріплення й закриває рев'ю | слухач у фазі перехоплення зупиняє подію, лише поки зсув закріплено |
| Перші тексти нащадків — службові («•», порожні) | беремо лише непорожні власні тексти; без них лишається клас (REQ-079-10) |

## Перевірка вимог

| Вимога | Перевірка |
|---|---|
| REQ-079-01 | `frontend/src/_helpers/moves.helper.test.ts › outlines where the element was on the baseline, dashed and named was` |
| REQ-079-02 | `frontend/src/_helpers/moves.helper.test.ts › outlines where the element is now on the current screenshot with the move` |
| REQ-079-03 | `frontend/integration_tests/test/movedElements.spec.ts › lights a moved element while the pointer is over its row` |
| REQ-079-04 | `frontend/integration_tests/test/movedElements.spec.ts › pins a moved element with a click and moves the pin to another row` |
| REQ-079-05 | `frontend/integration_tests/test/movedElements.spec.ts › unpins with a second click or Esc and keeps the review open` |
| REQ-079-06 | `frontend/src/_helpers/moves.helper.test.ts › shows the hovered move over the pinned one, and the pinned one after` |
| REQ-079-07 | `frontend/src/_helpers/moves.helper.test.ts › draws both outlines on the one screenshot in overlay and fade views` |
| REQ-079-08 | manual: закріпити зсув, перейти стрілкою до наступного екрана й назад — закріплення немає (скидання `pinnedMark` за `testRun.id`) |
| REQ-079-09 | `backend/src/ui-tree/ui-tree.parser.spec.ts › names a nameless element by the first two texts inside it, cut at 24 characters` |
| REQ-079-10 | `backend/src/ui-tree/ui-tree.parser.spec.ts › gives no texts for an element with nothing written inside` |
| REQ-079-11 | `frontend/src/_helpers/moves.helper.test.ts › keeps the name of an element with an id or a text of its own` |
| REQ-079-12 | `frontend/integration_tests/test/movedElements.spec.ts › names the moved element by what is inside and says how far it moved below` |
