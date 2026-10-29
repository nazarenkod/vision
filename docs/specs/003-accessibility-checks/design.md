# 003 — Дизайн

## Підхід

Правила — чисті функції над нормалізованим деревом (`UiNode[]`) і, для контрасту, над
декодованим скриншотом. Звіт будується під час прийому знімка за один прохід із рештою аналізу
дерева і зберігається файлом; у рядку знімка — лише лічильники. Порівняння з еталоном — за
стабільним ID знахідки `правило|ключ елемента`.

## Компоненти

| Компонент | Шлях | Роль |
|---|---|---|
| Правила | `backend/src/a11y/a11y.rules.ts` | `findViolations`, `buildReport`; пороги `MIN_TARGET` (48/44), `MIN_CONTRAST` 4,5, `MIN_CONTRAST_LARGE` 3, `LARGE_TEXT_HEIGHT_DP` 28 |
| Контраст | `backend/src/a11y/contrast.ts` | `estimateContrast`: колір тексту й фону в межах вузла, формула WCAG |
| Аналіз при прийомі | `backend/src/ui-tree/ui-tree.service.ts` | `analyze`: звіт, вибір дерева еталона (свого або іншого пристрою) |
| Лічильники | `backend/src/test-runs/test-runs.service.ts` | `analyzeUiTree`: `a11yNewCount`, `a11yTotalCount` з урахуванням рішень ([004](../004-a11y-problems/spec.md)) |
| UI | `frontend/src/components/TestDetailsDialog/InsightsPanel.tsx`, `TestDetailsModal.tsx` | вкладка Accessibility, оверлей рамок |

## Дані

Звіт — файл `<id>.a11y.json`: формат, щільність, порушення зі статусом, виправлені, заголовок
екрана. Правила й серйозність: `missing-label` (error), `touch-target`, `low-contrast`,
`input-without-label`, `duplicate-label`, `not-accessible` (warning), `redundant-role` (info).

## Перевірка вимог

| Вимога | Перевірка |
|---|---|
| REQ-003-01 | `backend/src/a11y/a11y.rules.spec.ts › finds the issues of an Android screen` |
| REQ-003-02 | `backend/src/a11y/a11y.rules.spec.ts › reads the text of child views as the label of a clickable container` |
| REQ-003-03 | `backend/src/a11y/a11y.rules.spec.ts › reports touch target size in dp` |
| REQ-003-10 | `backend/src/ui-tree/ui-tree.parser.spec.ts › estimates density when the client did not send it` |
| REQ-003-04 | `backend/src/a11y/a11y.rules.spec.ts › checks text contrast against the screenshot`; `backend/src/a11y/a11y.rules.spec.ts › computes WCAG ratios` |
| REQ-003-05 | `backend/src/a11y/a11y.rules.spec.ts › finds the issues of an Android screen` |
| REQ-003-11 | `backend/src/a11y/a11y.rules.spec.ts › finds the issues of an Android screen` |
| REQ-003-12 | `backend/src/a11y/a11y.rules.spec.ts › finds the issues of an Android screen`; `backend/src/a11y/a11y-issues.spec.ts › counts everything nobody acted on when there are no decisions` (порада не рахується) |
| REQ-003-13 | `backend/src/a11y/a11y.rules.spec.ts › finds the issues of an iOS screen` |
| REQ-003-06 | `backend/src/a11y/a11y.rules.spec.ts › splits issues into new, existing and fixed against the baseline`; `backend/src/a11y/a11y.rules.spec.ts › counts everything as new without a baseline tree` |
| REQ-003-07 | `backend/src/ui-tree/ui-tree.service.spec.ts › takes the newest baseline of the check on another device, on the run branch first`; `backend/src/ui-tree/ui-tree.service.spec.ts › ignores a reference device chosen before` |
| REQ-003-08 | `backend/src/a11y/a11y-issues.spec.ts › takes filed bugs out of the new count and false positives out of every count` |
| REQ-003-09 | manual: відкрити знімок з деревом → вкладка Accessibility, клік по картці |
