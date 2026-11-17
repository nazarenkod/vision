# 064 — Дизайн

## Підхід

Лише фронтенд; сервер, API і дані не змінюються.

**Кінець черги.** Рішення в порівнянні оголошує `useDecisionSnackbar` (кнопки Approve/Reject,
«Approve N waiting» на пристроях, баг із відхиленням). Порівняння з відкритою чергою дає через
контекст функцію `claim`: оголошення передає їй id знімків, яких стосується рішення, і чиста
функція `closesQueue` вирішує, чи після цього в зафіксованій черзі ще щось чекає. Якщо ні,
порівняння запам'ятовує «останнє рішення» (вид, `decisionId`, знімок), а оголошення не показує
сповіщення (REQ-064-01) і закриває попереднє сповіщення про рішення, якщо воно ще висить — інакше
на екрані знову два повідомлення. Поза порівнянням контексту немає, і все працює як раніше.

Картка показується, щойно рішення «закрило» чергу, не чекаючи, доки нові статуси прийдуть
сокетом: інакше без сокета людина лишилась би і без сповіщення, і без Undo. Коли статуси
приходять, умова `queueDone` (031) і далі тримає картку.

`QueueDone` переписано: один рядок статусу (`undo.approved` / `undo.rejected` у кольорі статусу,
або `queue.allDecided`, коли останнього рішення цієї людини немає — REQ-064-09), «Скасувати»
(лише з `decisionId`) і «Наступна» (лише з наступною чергою). Клік по затемненню закриває
порівняння тим самим `navigateById()`, що й Esc. Enter відкриває наступну чергу, як і раніше.

«Скасувати» кличе той самий `undoDecision`, що й Undo у сповіщенні. Після успіху картка ховається
(прапорець `undone`, доки черга знову не перестане бути «готовою»), порівняння відкриває той
знімок, і видно коротке «Скасовано». Відмова сервера — сповіщення з причиною, картка лишається.

Якщо рішення прийшло разом з повідомленням про баг (заведено й відхилено), повідомлення про баг
лишається — воно про інше, — але без Undo: Undo у картці. Пропозиції завести баг у картці немає
(REQ-064-10).

**Підказки клавіш.** Прибираємо значки `kbd`/`::after` з кнопок і меню, літери біля дій
елемента, і фрази «Hotkey: …» / «Клавіша: …» зі словників. Підказку, що була лише клавішею
(Approve, Reject, стрілки), прибираємо разом з `Tooltip`. Обробники клавіш не чіпаємо
(REQ-064-23). Тест словників не дає клавішам повернутися в тексти.

## Компоненти

| Компонент | Шлях | Роль |
|---|---|---|
| `closesQueue` | `frontend/src/_helpers/reviewQueue.helper.ts` | чиста: чи закриває рішення по цих id зафіксовану чергу |
| `QueueEndContext`, `useQueueEnd` | `frontend/src/components/TestDetailsDialog/queueEnd.context.ts` | `claim(ids, kind, decision)`; `null` поза чергою |
| `useDecisionSnackbar` | `frontend/src/components/useDecisionSnackbar.tsx` | приймає `ids`; якщо `claim` повернув `true` — без сповіщення (або без Undo, коли є власне повідомлення), закриває попереднє сповіщення про рішення |
| `TestDetailsDialog` | `frontend/src/components/TestDetailsDialog/index.tsx` | стан `ending`/`undone`, `claim`, Undo з картки, клік повз картку |
| `QueueDone` | `frontend/src/components/TestDetailsDialog/QueueDone.tsx` | нова картка: статус, «Скасувати», «Наступна» |
| `ApproveRejectButtons`, `DeviceStrip`, `TestDetailsModal` | `frontend/src/components/TestDetailsDialog/` | передають `ids`; без `keycap`, без підказок-клавіш |
| `ArrowButtons`, `ElementActions`, `WhatsCompared`, `CompareToolbar` | `frontend/src/components/TestDetailsDialog/` | без значків і фраз клавіш |
| `ElementReview`, `AccountMenu`, `TestRunListControls` | `frontend/src/components/` | без значків ⇧A, ⇧D, без «Hotkey: D» |
| словники | `frontend/src/i18n/en.ts`, `uk.ts` | `queue.allDecided`, `queue.reviewed`, `queue.next` без назви й числа; без «Hotkey»/«Клавіша»; прибрано `queue.done`, `queue.back`, `review.hotkey*`, `runs.diffHelp` |

## Дані

Немає.

## Потік

```mermaid
sequenceDiagram
  participant B as Approve/Reject
  participant S as useDecisionSnackbar
  participant D as TestDetailsDialog
  B->>S: announce(kind, 1, decision, { ids })
  S->>D: claim(ids, kind, decision)
  D->>D: closesQueue(frozen.ids, runs, ids)?
  D-->>S: true → ending = { kind, decisionId, runId }
  S->>S: без сповіщення; закрити попереднє
  D->>D: QueueDone(status, Скасувати, Наступна?)
  Note over D: Скасувати → undoDecision → undone, відкрити runId, «Скасовано»
```

## Ризики

| Ризик | Що робимо |
|---|---|
| Статуси приходять сокетом пізніше за відповідь на рішення, або не приходять | картка тримається на `ending`, а не лише на `queueDone` |
| Після Undo `queueDone` ще `true`, доки сокет не скаже «чекає» | прапорець `undone` ховає картку, доки черга не перестане бути готовою або не зміниться |
| Хтось шукає Approve за доступною назвою «Hotkey: A» | підказку прибрано, назва — «Approve»; тести шукали за текстом |
| Масове рішення на пристроях закриває чергу | ті самі `ids`; статус — «Прийнято» |

## Перевірка вимог

| Вимога | Перевірка |
|---|---|
| REQ-064-01 | `frontend/integration_tests/test/buildOverview.spec.ts › ends a queue with one card and no toast` |
| REQ-064-02 | `frontend/integration_tests/test/buildOverview.spec.ts › ends a queue with one card and no toast` |
| REQ-064-03 | `frontend/integration_tests/test/buildOverview.spec.ts › offers the next queue on the card when someone decided it all` |
| REQ-064-04 | `frontend/integration_tests/test/buildOverview.spec.ts › ends a queue with one card and no toast` |
| REQ-064-05 | `frontend/integration_tests/test/buildOverview.spec.ts › takes the last decision back from the card` |
| REQ-064-06 | `frontend/integration_tests/test/buildOverview.spec.ts › takes the last decision back from the card` |
| REQ-064-07 | `frontend/integration_tests/test/buildOverview.spec.ts › keeps the card and says why when Undo is refused` |
| REQ-064-08 | `frontend/integration_tests/test/buildOverview.spec.ts › closes the review with a click beside the card` |
| REQ-064-09 | `frontend/integration_tests/test/buildOverview.spec.ts › offers the next queue on the card when someone decided it all` |
| REQ-064-10 | `frontend/integration_tests/test/buildOverview.spec.ts › ends a queue with one card and no toast` |
| REQ-064-20 | `frontend/integration_tests/test/testDetailsDialog.spec.ts › shows no keys on the buttons of the review` |
| REQ-064-21 | `frontend/src/i18n/noKeyHints.test.ts › names no keys in any text` |
| REQ-064-22 | `frontend/integration_tests/test/testDetailsDialog.spec.ts › shows no keys on the buttons of the review` |
| REQ-064-23 | `frontend/integration_tests/test/testDetailsDialog.spec.ts › keeps the review layout and its keys` |
