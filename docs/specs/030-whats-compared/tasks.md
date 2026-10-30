# 030 — Задачі

Порядок: бекенд (T1–T2) і чисті хелпери фронтенду (T3) незалежні, бо T3 працює з типами й
моками `structure`. Компоненти (T4–T6) спираються на T3. Усе в гілці `spec/030-whats-compared`.

- [x] **T1** [P] (REQ-030-20, REQ-030-24, REQ-030-30, REQ-030-31, REQ-030-33) План «порівнювати
  лише» за одним деревом і поіменні обрані елементи.
  - Файли: `backend/src/ui-tree/compare-only.ts` + `compare-only.spec.ts`.
  - `planCompareOnly` з одним деревом → `keep`, `compared`, `ignoreOutside`, проблема `one-tree`;
    з двома → як було, плюс `compared` зі зсувом; без обох → `no-tree`.
  - Готово, коли: `npm test -- --testPathPattern compare-only` зелений.
- [x] **T2** (REQ-030-11, REQ-030-13, REQ-030-24, REQ-030-30, REQ-030-31) `UiTreeService` і статус.
  - Файли: `backend/src/ui-tree/ui-tree.service.ts` + `ui-tree.service.spec.ts`, `backend/src/test-runs/test-runs.service.spec.ts`.
  - `comparisonInputs` без поточного дерева, але з деревом еталона; `systemBarsFrom`; `structure()`
    → `size`, `systemBarsFrom`, `compareOnly.compared` у dp. Статус — тест, що прогін за одним
    деревом без змін іде на рев'ю.
  - Залежить від: T1.
  - Готово, коли: `npm test`, `npx tsc --noEmit -p tsconfig.json`, `eslint` по змінених файлах чисті.
- [x] **T3** [P] (REQ-030-01…04, REQ-030-10, REQ-030-12…14, REQ-030-20…23, REQ-030-32,
  REQ-030-40) Типи й чисті функції огляду.
  - Файли: `frontend/src/types/insights.ts`, `frontend/src/_helpers/whatsCompared.helper.ts` + `whatsCompared.helper.test.ts`.
  - `verdict`, `overview`, `elementState`; `summarize` і `groupRules` прибрати разом із їхніми
    тестами.
  - Готово, коли: `CI=true npx jest src/_helpers/whatsCompared` зелений.
- [x] **T4** (REQ-030-11) Схема екрана.
  - Файли: нові frontend/src/components/TestDetailsDialog/ComparedMap.tsx і ComparedMap.test.tsx.
  - Кольори лише з `tokens`; приглушення поза `keep`; опис для читачів екрана.
  - Залежить від: T3.
  - Готово, коли: тест компонента зелений.
- [x] **T5** (REQ-030-01…05, REQ-030-10…24, REQ-030-40, REQ-030-41) Результат і блок «Що
  порівнюється».
  - Файли: нові frontend/src/components/TestDetailsDialog/ComparisonVerdict.tsx, `frontend/src/components/TestDetailsDialog/WhatsCompared.tsx`, `frontend/src/i18n/en.ts`, `frontend/src/i18n/uk.ts`.
  - Залежить від: T3, T4.
  - Готово, коли: `npx tsc --noEmit -p .` не додає помилок до базових 25; `eslint` чистий.
- [x] **T6** (REQ-030-05, REQ-030-41, REQ-030-50, REQ-030-51) Вкладка «Зміни» й вибір елементів.
  - Файли: `frontend/src/components/TestDetailsDialog/InsightsPanel.tsx`, `frontend/src/components/TestDetailsDialog/TestDetailsModal.tsx`.
  - Порядок блоків, «Що змінилось · N», без двох речень, посилання «Обрати елементи», Undo для
    «Прибрати з порівнюваного».
  - Залежить від: T5.
- [x] **T7** (REQ-030-05, REQ-030-15, REQ-030-21, REQ-030-22, REQ-030-41, REQ-030-50,
  REQ-030-51) Playwright.
  - Файли: `frontend/integration_tests/test/elementRules.spec.ts`, `frontend/integration_tests/test/elementSelection.spec.ts`.
  - Наявні тести вкладки «Зміни», що шукають старі тексти, оновити, а не видаляти.
  - Скриншот-еталони — лише якщо змінився знятий екран, у Docker з копії frontend у scratchpad.
  - Залежить від: T6.
- [x] **T8** Документація.
  - «Перевірка вимог» у цьому design.md — у формат трасування; статус spec → `Implemented`.
  - spec.md 015: REQ-015-22 «змінено [030](../030-whats-compared/spec.md) REQ-030-30, 33»;
    spec.md 024: REQ-024-22, REQ-024-23 і «0 found» у US-3 — «замінено 030»; design.md 024 —
    нові тести для цих рядків.
  - Словник: «порівняння за одним деревом»; DEMO.md, якщо там описано вкладку «Зміни».
- [ ] **T9** `/verify`: тести, типи, лінт, еталони скриншотів, `scripts/check-docs.py`, сценарії
  приймання на копії даних (перевірка з еталоном із VRT і правилом «порівнювати лише»).
  - 2026-10-30: тести, типи, лінт, еталони (у Docker не змінились), `check-docs` пройдено;
    приймання на копії даних ще не робили.
