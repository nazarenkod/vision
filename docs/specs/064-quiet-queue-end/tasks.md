# 064 — Задачі

- [x] **T1** (REQ-064-01, REQ-064-02) `closesQueue` у `reviewQueue.helper.ts` з unit-тестами.
  - Готово, коли: `reviewQueue.helper.test.ts` зелений.
- [x] **T2** (REQ-064-01…10) `QueueEndContext`, `ids` в `useDecisionSnackbar` і його викликах у
  порівнянні; стан `ending`/`undone`, Undo і клік повз картку в `TestDetailsDialog`; нова
  `QueueDone`; словники.
  - Готово, коли: тести `buildOverview.spec.ts` про кінець черги зелені.
- [x] **T3** [P] (REQ-064-20…23) Прибрати значки й фрази клавіш: `ApproveRejectButtons`,
  `TestDetailsModal`, `ArrowButtons`, `ElementActions`, `WhatsCompared`, `CompareToolbar`,
  `ElementReview`, `AccountMenu`, `TestRunListControls`, словники; тест словників.
  - Готово, коли: `noKeyHints.test.ts › names no keys in any text` і
    `testDetailsDialog.spec.ts › shows no keys on the buttons of the review` зелені, тести клавіш
    не змінились.
- [x] **T4** Документація: позначки «Замінено» у 018, 024, 025, 031, 033, 036; статус 064 →
  `Implemented`; `frontend/AGENTS.md` про `QueueDone`.
- [x] **T5** `/verify` (скриншот-еталони порівняння — оновити в Docker).
