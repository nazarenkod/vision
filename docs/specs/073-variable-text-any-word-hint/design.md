# 073 — Дизайн

## Підхід

У `ElementPopover.tsx` підказка під шматками (`variableHint`) для перевірки «лише слова»
(`wordsOnly`) показує `select.variableAnyWord` замість `select.variableRest`; помаранчевий блок
прибрано. У блоці правила той самий текст сірим. Ключ `select.variableWordsOnly` замінено на
`select.variableAnyWord` (EN/UK).

## Перевірка вимог

| Вимога | Перевірка |
|---|---|
| REQ-073-01 | `frontend/src/components/TestDetailsDialog/ElementPopover.test.tsx › says any word may stand there instead of the rest being exact` |
| REQ-073-02 | `frontend/src/components/TestDetailsDialog/ElementPopover.test.tsx › says plainly that any word may stand in a saved rule's whole-word place` |
