# 001 — Дизайн

## Підхід

Модель upstream не змінюється: варіація (`TestVariation`) як і раніше відповідає профілю
пристрою й тримає його еталон. Перевірка — це обчислене поняття `checkKey(name, customTags)`:
UI групує прогони й варіації за ним, а правила й рішення зберігаються за ключем перевірки, а не
за варіацією. Міграція не потрібна.

## Компоненти

| Компонент | Шлях | Роль |
|---|---|---|
| Ключ перевірки | `backend/src/ui-tree/comparison-inputs.ts` | `checkKey`, `sameDevice`; правила перевірки в `uiTreeSettings.checkRules` |
| Правила | `backend/src/ui-tree/ui-tree.service.ts` | `checkRules`: правила перевірки + правила старих версій на варіаціях |
| Смуга пристроїв | `frontend/src/components/TestDetailsDialog/DeviceStrip.tsx` | `runsOfCheck`, Approve all |
| Еталони | `frontend/src/components/TestVariationList.tsx` | `groupByCheck` |

## Перевірка вимог

| Вимога | Перевірка |
|---|---|
| REQ-001-01 | `frontend/src/components/checkGrouping.test.ts › finds the same check on every device of the build, by name and custom tags` |
| REQ-001-02 | `backend/src/ui-tree/ui-tree.service.spec.ts › takes the newest baseline of the check on another device, on the run branch first` (еталони лишаються по пристроях); manual: піксельний діф на одному пристрої не змінюється від іншого |
| REQ-001-03 | `frontend/src/components/checkGrouping.test.ts › finds the same check on every device of the build`; manual: «Approve all N» |
| REQ-001-04 | `backend/src/test-runs/test-runs.service.spec.ts › keeps a rule for this screen by check, so every device and branch gets it`; `backend/src/ui-tree/ui-tree.service.spec.ts › joins the rules kept by check with rules older versions kept on device variations` |
| REQ-001-05 | `frontend/src/components/checkGrouping.test.ts › puts each check` |
| REQ-001-06 | manual: сторінка Baselines на копії бази проду показує перевірки без міграції |
