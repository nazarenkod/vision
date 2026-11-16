# 015 — Дизайн

Спільний з [024](../024-elements-instead-of-areas/design.md): там підхід, компоненти, дані, потік
і ризики. «Порівнювати лише» — третя дія правила елемента (`compare`), що зберігається для
перевірки; елемент еталона переноситься на місце елемента знімка, усе поза обраними елементами
ігнорується, а різниця рахується від їхньої площі
([ADR-0018](../../decisions/0018-compare-only-measures-compared-elements.md)). Задачі — у
[tasks.md 024](../024-elements-instead-of-areas/tasks.md).

## Перевірка вимог

| Вимога | Перевірка |
|---|---|
| REQ-015-01 | `backend/src/ui-tree/comparison-inputs.spec.ts › reads compare-only rules with every kind of selector` |
| REQ-015-02 | `backend/src/ui-tree/ui-tree.service.spec.ts › applies a check's compare-only rule on every device and branch` |
| REQ-015-03 | `backend/src/ui-tree/compare-only.spec.ts › compares every element any compare-only rule matches` |
| REQ-015-04 | `frontend/integration_tests/test/elementSelection.spec.ts › compares only a picked element` |
| REQ-015-10 | `backend/src/ui-tree/compare-only.spec.ts › ignores everything outside the compared elements`; `backend/src/compare/libs/pixelmatch/pixelmatch.core.spec.ts › counts no change outside the compared elements`; `backend/src/ui-tree/ui-tree.service.spec.ts › reports no hidden change outside the compared elements` |
| REQ-015-11 | `backend/src/ui-tree/compare-only.spec.ts › compares an element that moved with itself` |
| REQ-015-12 | `backend/src/ui-tree/compare-only.spec.ts › treats a resized element as changed` |
| REQ-015-13 | `backend/src/ui-tree/compare-only.spec.ts › keeps ignored elements and areas ignored inside a compared one` |
| REQ-015-14 | `backend/src/ui-tree/compare-only.spec.ts › pairs several matches in screen order and flags a different count` |
| REQ-015-20 | `backend/src/ui-tree/compare-only.spec.ts › reports an element that disappeared or appeared`; `backend/src/test-runs/test-runs.service.spec.ts › sends a run whose compared element is gone to review` |
| REQ-015-21 | `backend/src/ui-tree/compare-only.spec.ts › reports a rule that found nothing` |
| REQ-015-22 | `backend/src/ui-tree/ui-tree.service.spec.ts › never passes a compare-only run without a UI tree` |
| REQ-015-23 | `backend/src/test-runs/test-runs.service.spec.ts › refuses a compare-only rule for every screen` |
| REQ-015-30 | `frontend/integration_tests/test/elementSelection.spec.ts › dims the screenshot outside the compared elements` |
| REQ-015-31 | `frontend/src/_helpers/whatsCompared.helper.test.ts › shows how many elements each rule found on each screenshot` |
