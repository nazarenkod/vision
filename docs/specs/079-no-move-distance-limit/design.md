# 079 — Дизайн

## Підхід

Прибираємо поле і параметр, а не ховаємо: прихована межа діяла б на порівняння, і її не було б
де побачити чи змінити. `computeMoves` більше не приймає відстань, а `UiTreeSettings` на
бекенді й фронтенді не мають `maxMoveDp`. `parseUiTreeSettings` розгортає збережений JSON
цілком, тож старе значення лишається в об'єкті й у даних, але його ніхто не читає. Сторінка
зберігає налаштування тим самим розгортанням, тож значення не губиться (ADR-0003).

ADR не потрібен: рішення легко повернути, причини — у spec.md.

## Компоненти

| Компонент | Шлях | Роль |
|---|---|---|
| Компенсація зсувів | `backend/src/ui-tree/comparison-inputs.ts`, `ui-tree.service.ts` | `computeMoves(baseline, current)` без межі; `maxMoveDp` зникає з типу й значень за замовчуванням |
| Сторінка налаштувань | `frontend/src/components/ProjectForm/ProjectForm.tsx` | без поля `maxMoveDp` |
| Пошук налаштувань | `frontend/src/_helpers/projectSettings.helper.ts` | без ярлика `mobile.maxMove` і поля в мапі розділів |
| Тип і словники | `frontend/src/types/insights.ts`, `src/i18n/en.ts`, `uk.ts` | без `maxMoveDp` і ключа `mobile.maxMove` |

## Перевірка вимог

| Вимога | Перевірка |
|---|---|
| REQ-079-01 | `frontend/integration_tests/test/projectSettings.spec.ts › has no distance limit under the moves switch, on or off` |
| REQ-079-01 | `frontend/src/_helpers/projectSettings.helper.test.ts › finds only the moves switch, with no distance limit, in either language` |
| REQ-079-02 | `backend/src/ui-tree/comparison-inputs.spec.ts › compensates a move of any distance` |
