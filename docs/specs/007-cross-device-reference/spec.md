# 007 — Довідкове порівняння з еталонним пристроєм

- **Статус:** Implemented (лише довідка; див. [ADR-0006](../../decisions/0006-cross-device-is-informational.md))
- **Оновлено:** 2026-10-27
- **Код:** `backend/src/ui-tree/cross-device.ts`, `ui-tree.service.ts` (`crossDevice`, `recordCrossDevice`),
  таблиця `CrossDeviceCheck`, `frontend/…/CrossDevicePanel.tsx`

## Проблема

Хочеться ловити розбіжності між пристроями (емулятор проти BrowserStack): зник елемент,
інший підпис чи стан. Але розкладки різняться, тож надійність такого порівняння невідома.

## Вимоги

| ID | Вимога |
|---|---|
| REQ-007-01 | ДЕ в проєкті вибрано еталонний пристрій, СИСТЕМА ПОВИННА порівнювати дерево кожного іншого пристрою з деревом тієї ж перевірки на еталонному: спершу прогін цієї ж збірки, інакше еталон гілки прогону, інакше основної гілки. |
| REQ-007-02 | СИСТЕМА ПОВИННА повідомляти про знайдені на обох пристроях елементи з іншим текстом, підписом чи станом, а ненайдені — перелічувати, не називаючи їх зниклими (вони можуть бути за межами екрана). |
| REQ-007-03 | СИСТЕМА ПОВИННА ніколи не змінювати статус знімка через це порівняння. |
| REQ-007-04 | СИСТЕМА ПОВИННА не порівнювати дерево iOS з деревом Android. |
| REQ-007-05 | СИСТЕМА ПОВИННА зберігати результат і подальше рішення рев'юера в `CrossDeviceCheck`, щоб згодом оцінити, чи можна порівнянню довіряти. |

## Трасування

| Вимога | Перевірка (`backend/src/ui-tree/…`) |
|---|---|
| 01 | `ui-tree.service.spec.ts › compares with the reference device run of the same build first`, `› falls back to the reference device baseline…`, `› asks for a reference device when the project has none`, `› says so for a run on the reference device itself` |
| 02 | `cross-device.spec.ts › finds nothing to report for the same screen laid out for another size`, `› reports a found element whose state or label differs`, `› lists elements it cannot find without calling them missing` |
| 03 | дизайн: результат не потрапляє в `status`; manual |
| 04 | `ui-tree.service.spec.ts › does not compare an iOS tree with an Android one` |
| 05 | `ui-tree.service.spec.ts › keeps the result with the reviewer decision`; SQL для оцінки — у [DEMO.md](../../../DEMO.md) |
