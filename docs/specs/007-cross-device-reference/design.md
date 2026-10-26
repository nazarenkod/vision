# 007 — Дизайн

## Підхід

`compareAcrossDevices(reference, here)` зіставляє елементи двох дерев за ідентифікаторами й
текстами, незалежно від розкладки, і повертає відмінності та ненайдені елементи. Сервіс обирає
дерево еталонного пристрою (прогін збірки → еталон гілки → основна гілка), а результат і рішення
рев'юера пише в `CrossDeviceCheck`.

## Компоненти

| Компонент | Шлях | Роль |
|---|---|---|
| Порівняння | `backend/src/ui-tree/cross-device.ts` | `compareAcrossDevices` |
| Вибір еталона й запис | `backend/src/ui-tree/ui-tree.service.ts` | `crossDevice`, `recordCrossDevice` |
| API | `backend/src/test-runs/test-runs.controller.ts` | `GET /test-runs/:id/cross-device` |
| UI | `frontend/src/components/TestDetailsDialog/CrossDevicePanel.tsx` | вкладка Devices |

## Дані

`CrossDeviceCheck`: прогін, еталонний прогін, кількість відмінностей і ненайдених, рішення.
Запит для оцінки — у [DEMO.md](../../../DEMO.md).

## Перевірка вимог

| Вимога | Перевірка |
|---|---|
| REQ-007-01 | `backend/src/ui-tree/ui-tree.service.spec.ts › compares with the reference device run of the same build first`; `backend/src/ui-tree/ui-tree.service.spec.ts › falls back to the reference device baseline, on the run branch before the main one` |
| REQ-007-06 | `backend/src/ui-tree/ui-tree.service.spec.ts › asks for a reference device when the project has none`; `backend/src/ui-tree/ui-tree.service.spec.ts › says so for a run on the reference device itself` |
| REQ-007-02 | `backend/src/ui-tree/cross-device.spec.ts › reports a found element whose state or label differs`; `backend/src/ui-tree/cross-device.spec.ts › finds nothing to report for the same screen laid out for another size` |
| REQ-007-07 | `backend/src/ui-tree/cross-device.spec.ts › lists elements it cannot find without calling them missing` |
| REQ-007-03 | manual: знімок з розбіжностями лишає свій піксельний статус |
| REQ-007-04 | `backend/src/ui-tree/ui-tree.service.spec.ts › does not compare an iOS tree with an Android one` |
| REQ-007-05 | `backend/src/ui-tree/ui-tree.service.spec.ts › keeps the result with the reviewer decision` |
