# 024 — Задачі (разом із 015)

Порядок: спершу бекенд (T1–T5), бо фронтенд читає нові поля `structure`. T6–T7 можна робити
паралельно з бекендом: це чисті хелпери й полотно, і вони не чіпають тих самих файлів.

- [x] **T1** (REQ-015-01, REQ-015-03, REQ-015-10…14, REQ-015-20, REQ-015-21, REQ-024-17) Дія
  `compare` і план «порівнювати лише».
  - Файли: `backend/src/ui-tree/comparison-inputs.ts`, новий `backend/src/ui-tree/compare-only.ts` + `compare-only.spec.ts`.
  - `resolveRules` повертає `boundsByRule` і кількість збігів у кожному дереві, а `compare` пропускає.
  - Готово, коли: тести `compare-only.spec.ts` і `comparison-inputs.spec.ts` зелені.
- [x] **T2** [P] (ADR-0018) `measureAreas` у pixelmatch.
  - Файли: `backend/src/compare/libs/pixelmatch/pixelmatch.core.ts`, `pixelmatch.service.ts`, `backend/src/compare/libs/ImageCompareInput.ts`.
  - Готово, коли: «counts no change outside the compared elements» зелений, а наявні тести
    pixelmatch не змінились.
- [x] **T3** [P] (REQ-024-40, REQ-024-50) `elementForArea` і елемент у підказках про шум.
  - Файли: новий `backend/src/ui-tree/area-elements.ts` + `area-elements.spec.ts`, `backend/src/ui-tree/noise-hints.ts`.
  - Готово, коли: `area-elements.spec.ts` зелений.
- [x] **T4** (REQ-015-02, REQ-015-10, REQ-015-22, REQ-015-31, REQ-024-02, REQ-024-04, REQ-024-40,
  REQ-024-50) `UiTreeService`: план у `comparisonInputs`, нові поля в `structure()`.
  - Нові поля `structure()`: `compareOnly`, межі правил, `baselineElements`, `parent`, `element`
    у підказках, `areaSuggestions`.
  - Файли: `backend/src/ui-tree/ui-tree.service.ts` + `ui-tree.service.spec.ts`.
  - Залежить від: T1, T3.
  - Готово, коли: названі в «Перевірці вимог» тести `ui-tree.service.spec.ts` зелені.
- [x] **T5** (REQ-015-20, REQ-015-23, REQ-024-16, REQ-024-51) Статус, API правил, заміна області.
  - Файли: `backend/src/test-runs/test-runs.service.ts`, `test-runs.controller.ts`, `dto/element-rule.dto.ts`, `test-runs.service.spec.ts`.
  - Залежить від: T2, T4.
  - Готово, коли: тести `test-runs.service.spec.ts` зелені; `npm test`, `tsc`, `eslint` по
    змінених файлах чисті.
- [ ] **T6** [P] (REQ-024-02…05, REQ-024-22, REQ-024-23, REQ-015-31) Типи й чисті хелпери фронтенду.
  - Файли: `frontend/src/types/insights.ts`, `frontend/src/services/insights.service.ts`, нові `frontend/src/_helpers/elementPicking.helper.ts` і `whatsCompared.helper.ts` з тестами.
  - Готово, коли: `CI=true npx jest` зелений.
- [ ] **T7** [P] (REQ-024-20, REQ-015-30) Полотно: штриховка, пунктир, затемнення поза областями.
  - Файли: `frontend/src/components/TestDetailsDialog/DrawArea.tsx`.
  - Кольори беремо з `useTokens()`: сірий для ignore, `status.new` для допуску, `brand` для
    compare only.
- [ ] **T8** (REQ-024-01, REQ-024-03, REQ-024-05…10, REQ-024-15, REQ-024-16, REQ-024-21,
  REQ-024-33) Рядок інструментів і режим вибору.
  - Що: «Select elements» (E), `ElementPopover` (I / C / T, ↑ / ↓, «⋯» → наявна форма правила),
    Shift, Esc, `useRuleSnackbar` з Undo, перемикач позначок у `localStorage`.
  - Файли: `TestDetailsModal.tsx`, новий `ElementPopover.tsx`, новий `frontend/src/components/useRuleSnackbar.tsx`, `frontend/src/i18n/en.ts`, `uk.ts`.
  - Залежить від: T6, T7.
- [ ] **T9** (REQ-024-30…34, REQ-024-50, REQ-024-51) `AreasMenu`.
  - Що: колишні інструменти з підписами, лічильник, «Use element», питання про незбережене.
  - Файли: новий `AreasMenu.tsx`, `TestDetailsModal.tsx` (прибрати `ignoreAreasToolbar`), i18n.
  - Залежить від: T8 (той самий файл, після нього).
- [ ] **T10** (REQ-024-22…24, REQ-024-40, REQ-024-41, REQ-015-20…22, REQ-015-31) Панель.
  - Що: `WhatsCompared` замість «Rules for this screen» і «Pick element»; «Ignore» у підказці
    про шум; Ignore + «⋯» у рядку зміненої області.
  - Файли: новий `WhatsCompared.tsx`, `InsightsPanel.tsx`, i18n.
  - Залежить від: T6.
- [ ] **T11** Playwright.
  - Що: новий `frontend/integration_tests/test/elementSelection.spec.ts` (моки `structure` з
    деревом і без); `ignoreAreas.spec.ts` через «Areas»; `elementRules.spec.ts` під новий блок.
  - Еталони скриншотів `projec.spec.ts` (рядок інструментів змінився) перезнімаємо лише в
    Docker, переглянувши знімок.
  - Залежить від: T8–T10.
- [ ] **T12** Документація.
  - Статуси 015 і 024 → `Implemented`; ADR-0018 → `Accepted` після згоди.
  - `DEMO.md`: як показати вибір елементів.
  - [018](../018-ui-redesign/spec.md): посилання на 024 біля вимог до рядка інструментів.
  - [019](../019-element-rules-in-review/spec.md): «Rules for this screen» тепер «What's compared».
- [ ] **T13** `/verify`: тести, типи, лінт, еталони скриншотів, `python3 -I scripts/check-docs.py`,
  сценарії приймання 015 і 024 на демо-даних.
