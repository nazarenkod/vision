# 028 — Задачі

Дизайн: [design.md](design.md).

- [ ] **T1** [P] (REQ-028-03, 05, 30, 31, 33) Правила вибору чистими функціями.
  - Файли: `frontend/src/_helpers/elementPicking.helper.ts`, `frontend/src/_helpers/elementPicking.helper.test.ts`.
  - `addToSelection` з `MAX_SELECTED = 3` замість `toggleSelection`; `sortSelected`; `panelSide`.
  - Готово, коли: нові тести хелпера й наявний «adds elements to the selection with Shift» зелені.
- [ ] **T2** [P] (REQ-028-11) Номер на рамці.
  - Файли: `frontend/src/components/TestDetailsDialog/DrawArea.tsx`.
  - Необов'язкове `OverlayRect.badge` — кружечок із номером у куті рамки, кольору рамки.
  - Готово, коли: без `badge` рамки ті самі (скриншот-еталони не змінились).
- [ ] **T3** Спільні дії з `ElementPopover` винести в `ElementActions.tsx` без зміни поведінки.
  - Файли: frontend/src/components/TestDetailsDialog/ElementActions.tsx (новий), `ElementPopover.tsx`.
  - Готово, коли: усі наявні тести `elementSelection.spec.ts` зелені без змін.
- [ ] **T4** (REQ-028-01, 02, 03, 04, 06) «Add more elements» і вибір кліком.
  - Файли: `ElementPopover.tsx`, `TestDetailsModal.tsx`, `i18n/en.ts`, `i18n/uk.ts`.
  - `Selection.adding`; додавання з Shift, з `adding` або коли обрано ≥ 2, лише на тому самому
    знімку; підказка з Shift у `selectingBar`.
  - Готово, коли: тести REQ-028-01…06 з design.md зелені.
- [ ] **T5** (REQ-028-10, 12, 13, 14, 15, 24, 30, 31, 32, 33) Панель вибору.
  - Файли: frontend/src/components/TestDetailsDialog/SelectionPanel.tsx (новий), `TestDetailsModal.tsx`, `i18n/en.ts`, `i18n/uk.ts`.
  - Панель замість підказки біля елемента для 2–3 обраних, положення за `panelSide`, номери на
    рамках, підсвітка при наведенні, ×, Clear, «Remove N rules» з підтвердженням.
  - Готово, коли: тести REQ-028-10…15, 24, 30…32 зелені; «adds one rule per selected element»
    переписаний під панель.
- [ ] **T6** (REQ-028-20, 21, 22, 23) Дія для кількох.
  - Файли: `TestDetailsModal.tsx`, `i18n/en.ts`, `i18n/uk.ts`.
  - Пропуск обраних з правилом, одне Undo, збій посередині, очищення вибору.
  - Готово, коли: тести REQ-028-20…23 зелені.
- [ ] **T7** Документація: «Перевірка вимог» у design.md — з «план:» на `шлях › назва`;
  статус spec → `Implemented`; рішення власника щодо SC-028-03 записане в spec.md; рядок про
  панель вибору в DEMO.md, якщо там описано вибір елементів.
- [ ] **T8** `/verify`: jest, `tsc` (не більше базових 25 помилок), eslint і prettier по змінених
  файлах, Playwright `elementSelection.spec.ts`, скриншот-еталони в Docker, якщо змінився знятий
  екран, `python3 -I scripts/check-docs.py`; ручні REQ-028-11, REQ-028-12, SC-028-03.
