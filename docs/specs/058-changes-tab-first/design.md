# 058 — Дизайн

## Підхід

Вкладка панелі порівняння (`InsightsPanel`) типово «Зміни» для будь-якого знімка, і вкладка «Зміни»
стоїть першою (REQ-058-01). Панель повідомляє діалогу обрану вкладку через `onTabChange`; діалог
(`TestDetailsModal`) малює рамки знахідок на поточному знімку лише тоді, коли обрано «Доступність» і
перемикач «Підсвічувати на поточному» увімкнено (REQ-058-02, 03). Стан перемикача окремий від
вкладки: повернувшись на «Доступність», QA бачить рамки такими, як лишив.

## Компоненти

| Компонент | Шлях | Роль |
|---|---|---|
| `InsightsPanel` | `frontend/src/components/TestDetailsDialog/InsightsPanel.tsx` | порядок і типова вкладка, `onTabChange`, тип `PanelTab` |
| `TestDetailsModal` | `frontend/src/components/TestDetailsDialog/TestDetailsModal.tsx` | `panelTab`; рамки знахідок лише на «Доступності» |

## Дані

Без змін.

## Ризики

| Ризик | Що робимо |
|---|---|
| Тести й звички, що чекали «Доступність» типовою | тести відкривають вкладку явно |

## Перевірка вимог

| Вимога | Перевірка |
|---|---|
| REQ-058-01 | `frontend/integration_tests/test/a11yProblems.spec.ts › shows the frames on the screenshot only on the Accessibility tab, which comes after Changes` |
| REQ-058-02 | `frontend/integration_tests/test/a11yProblems.spec.ts › shows the frames on the screenshot only on the Accessibility tab, which comes after Changes` |
| REQ-058-03 | `frontend/integration_tests/test/a11yProblems.spec.ts › shows the frames on the screenshot only on the Accessibility tab, which comes after Changes` |
