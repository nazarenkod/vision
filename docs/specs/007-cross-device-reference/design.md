# 007 — Дизайн

## Підхід

`compareAcrossDevices(reference, here)` зіставляє елементи двох дерев за ідентифікаторами й
текстами, незалежно від розкладки, і повертає відмінності та ненайдені елементи. Сервіс обирає
дерево еталонного пристрою (прогін збірки → еталон гілки → основна гілка), а результат і рішення
рев'юера пише в `CrossDeviceCheck`.

## Компоненти

| Компонент | Шлях | Роль |
|---|---|---|
| Порівняння | `ui-tree/cross-device.ts` (видалено в 020) | `compareAcrossDevices` |
| Вибір еталона й запис | `backend/src/ui-tree/ui-tree.service.ts` | `crossDevice`, `recordCrossDevice` (видалено в [020](../020-remove-reference-device/spec.md)) |
| API | `backend/src/test-runs/test-runs.controller.ts` | `GET /test-runs/:id/cross-device` (видалено в [020](../020-remove-reference-device/spec.md)) |
| UI | `CrossDevicePanel.tsx` (видалено в 020) | вкладка Devices |

## Дані

`CrossDeviceCheck`: прогін, еталонний прогін, кількість відмінностей і ненайдених, рішення.
Запит для оцінки — у [DEMO.md](../../../DEMO.md).

## Перевірка вимог

| Вимога | Перевірка |
|---|---|
| REQ-007-01 | manual: знято 020 |
| REQ-007-06 | manual: знято 020 |
| REQ-007-02 | manual: знято 020 |
| REQ-007-07 | manual: знято 020 |
| REQ-007-03 | manual: знято 020 |
| REQ-007-04 | manual: знято 020 |
| REQ-007-05 | manual: знято 020 |
