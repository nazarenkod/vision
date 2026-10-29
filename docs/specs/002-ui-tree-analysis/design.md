# 002 — Дизайн

## Підхід

Дерево розбирається один раз при прийомі в нормалізований список `UiNode` з межами в пікселях
скриншота й зберігається файлом. Налаштування проєкту (`uiTreeSettings`) перетворюються на
входи піксельного порівняння: ігноровані прямокутники, допуски, компенсація зсувів. Перевірки
екрана — чисті функції над деревами еталона й знімка та областями змін.

## Компоненти

| Компонент | Шлях | Роль |
|---|---|---|
| Розбір | `backend/src/ui-tree/ui-tree.parser.ts` | формат, межі, щільність, ключі вузлів |
| Входи порівняння | `backend/src/ui-tree/comparison-inputs.ts` | `parseUiTreeSettings`, селектори, `resolveRules`, `findSystemBars`, `computeMoves`, допуски |
| Структурний діф | `backend/src/ui-tree/structure-diff.ts` | `diffTrees`, `elementsUnderRegions` |
| Перевірки екрана | `backend/src/ui-tree/screen-checks.ts` | `detectLoading`, `invisibleChanges`, `screenSimilarity` (`MISMATCH_BELOW` 0,35), `componentChanges` |
| Оркестрація | `backend/src/ui-tree/ui-tree.service.ts` | `store`, `analyze`, `comparisonInputs`, `recheck`, `structure` |
| Статус | `backend/src/test-runs/test-runs.service.ts` | `analyzeUiTree`: прихована зміна → `unresolved` |
| UI | `frontend/src/components/TestDetailsDialog/InsightsPanel.tsx` | вкладка Changes, вибір елемента на скриншоті |

## Дані

`TestRun`: `uiTreeName`, `baselineUiTreeName`, `uiTreeOptions`, `diffRegions`,
`captureWarnings`, `semanticChangeCount`, `componentChanges`. Файл дерева —
`<id>.uitree.json.gz`. Налаштування — `Project.uiTreeSettings`.

## Перевірка вимог

| Вимога | Перевірка |
|---|---|
| REQ-002-01 | `backend/src/ui-tree/ui-tree.parser.spec.ts › detects the format`; `backend/src/ui-tree/ui-tree.parser.spec.ts › reads nodes by their class attribute and treats them as visible` |
| REQ-002-02 | `backend/src/ui-tree/ui-tree.parser.spec.ts › converts pixels to dp from the device density`; `backend/src/ui-tree/ui-tree.parser.spec.ts › scales bounds when the screenshot is smaller than the screen`; `backend/src/ui-tree/ui-tree.parser.spec.ts › detects the format and converts points to screenshot pixels` |
| REQ-002-03 | `backend/src/ui-tree/ui-tree.parser.spec.ts › gives every node a unique key, preferring resource ids` |
| REQ-002-04 | `backend/src/ui-tree/ui-tree.parser.spec.ts › rejects input that is not an Appium page source` |
| REQ-002-10 | `backend/src/ui-tree/comparison-inputs.spec.ts › uses the status and navigation bar views when the tree has them`; `backend/src/ui-tree/comparison-inputs.spec.ts › falls back to a 24 dp band at the top` |
| REQ-002-11 | `backend/src/ui-tree/comparison-inputs.spec.ts › only flags what is new once the move is compensated`; `backend/src/ui-tree/comparison-inputs.spec.ts › respects the maximum distance`; `backend/src/ui-tree/comparison-inputs.spec.ts › ignores elements that changed size` |
| REQ-002-14 | `backend/src/ui-tree/comparison-inputs.spec.ts › still flags a moved card that also changed` |
| REQ-002-12 | `backend/src/ui-tree/comparison-inputs.spec.ts › matches text exactly or by regular expression`; `backend/src/ui-tree/comparison-inputs.spec.ts › clears small changes inside a tolerated area` |
| REQ-002-15 | `backend/src/ui-tree/comparison-inputs.spec.ts › covers an element where it was and where it is now` |
| REQ-002-13 | manual: Changes → «Pick element on screenshot» → клік → правило з елемента |
| REQ-002-20 | `backend/src/ui-tree/screen-checks.spec.ts › reports a control that became disabled when the pixels did not change`; `backend/src/ui-tree/screen-checks.spec.ts › reports an invisible control added on top of the screen`; `backend/src/test-runs/test-runs.service.spec.ts › calculateDiff keeps a run in review when the pixels match but an element change stays hidden` |
| REQ-002-21 | manual: знято 020 |
| REQ-002-22 | manual: знято 020 |
| REQ-002-24 | manual: знято 020 |
| REQ-002-23 | `backend/src/ui-tree/structure-diff.spec.ts › reports text changes, added and removed elements and resizes`; `backend/src/ui-tree/structure-diff.spec.ts › names the element that best wraps each changed area` |
