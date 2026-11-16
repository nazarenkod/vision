# 061 — Задачі

- [x] **T1** (REQ-061-05, REQ-061-08, REQ-061-09) Друга форма опори в `parseXpath` і `anchorsOf`.
  - Файли: `backend/src/ui-tree/xpath-selector.ts`, `xpath-selector.spec.ts`; нова фікстура
    `__fixtures__/ios-history.xml` з рядками, що мають довгі підписи.
  - Готово, коли: `accepts starts-with() only as the anchor's condition` зелений; у
    `finds what XPath over the page source finds` є вирази з `starts-with`, а очікування для них
    записані з `xpath@0.0.34` над сирим XML (ставимо в scratchpad, а не в залежності); старі
    очікування не змінились.
- [x] **T2** (REQ-061-01, -02, -03, -04, -06) `textStart`, `anchorStep` за початком,
  `anchorMatch`, `MAX_SELECTOR_LENGTH` і фільтр довжини. Залежить від T1.
  - Файли: `backend/src/ui-tree/selector-variants.ts`, `selector-variants.spec.ts`,
    `comparison-inputs.ts`, `backend/src/test-runs/dto/element-rule.dto.ts`.
  - Готово, коли: п'ять тестів із «Перевірки вимог» зелені, а наявні тести
    `selector-variants.spec.ts`, `pickable-elements.spec.ts` і `structure.characterization.spec.ts`
    проходять без зміни очікувань (SC-061-04).
- [x] **T3** [P] (REQ-061-07) Попередження з початком тексту й підказки форми.
  - Файли: `frontend/src/types/insights.ts`, `ElementPopover.tsx`, `ElementPopover.test.tsx`,
    `frontend/src/i18n/en.ts`, `uk.ts`.
  - Готово, коли: `names the start of the text the rule hangs on` зелений; тексти є обома мовами.
- [x] **T4** Документація: статус spec → `Implemented` (рішення власника 2026-11-16, до T5); у 027 позначки «Замінено 2026-11-16 [061] …»
  біля REQ-027-11, -12, -15, -30, -31 і оновлені граничні випадки; «Поза межами» 027 без
  `starts-with()`; глосарій «Опора»; доповнення в ADR-0021; рядок у `docs/specs/README.md`.
- [ ] **T5** `/verify`: тести, типи, лінт, `scripts/check-docs.py`; сценарій US-1 вручну на
  дереві iOS з довгим підписом (правило зберігається, елемент заштриховано).
