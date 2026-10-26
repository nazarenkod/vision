# 008 — Insights

- **Статус:** Implemented
- **Оновлено:** 2026-10-27
- **Код:** `backend/src/analytics/insights.ts` (`computeInsights`, чиста функція), `analytics.service.ts`,
  `GET /analytics/:projectId?days=`, `frontend/src/pages/InsightsPage.tsx`

## Проблема

Немає відповіді на питання, де шум, які еталони мертві, які екрани нестабільні, де найбільше
проблем доступності і чого бракує в покритті пристроїв.

## Вимоги

| ID | Вимога |
|---|---|
| REQ-008-01 | СИСТЕМА ПОВИННА рахувати Insights проєкту за вибраний період 30–365 днів. |
| REQ-008-02 | СИСТЕМА ПОВИННА показувати еталони, з якими за період нічого не порівнювалось, і давати масово видалити їх із підтвердженням. |
| REQ-008-03 | СИСТЕМА ПОВИННА ранжувати нестабільні екрани: спершу за «миганнями» (екран відрізнявся, а наступний прогін знову збігся з тим самим еталоном), потім за частотою змін. Якщо між прогонами змінився еталон, це не «мигання». |
| REQ-008-04 | СИСТЕМА ПОВИННА показувати екрани з найбільшою кількістю знахідок доступності (за найновішим прогоном) з ухваленими рішеннями, а також найчастіші правила. |
| REQ-008-05 | СИСТЕМА ПОВИННА показувати шум (дрібні зміни, які щоразу приймають), знімки «знято зарано» і з прихованими змінами. |
| REQ-008-06 | СИСТЕМА ПОВИННА перелічувати перевірки, яких бракує пристрою на основній гілці. |
| REQ-008-07 | СИСТЕМА ПОВИННА показувати чергу рев'ю (за найновішим прогоном кожного еталона) і медіанний час до рішення. |
| REQ-008-08 | КОЛИ ліміт збірок проєкту видалив старішу історію, СИСТЕМА ПОВИННА сказати про це й судити лише за тим, що лишилося. |

## Трасування

| Вимога | Перевірка (`backend/src/analytics/insights.spec.ts`) |
|---|---|
| 02 | `› suggests deleting baselines nothing was compared with during the window`; `frontend/integration_tests/test/insights.spec.ts › deletes the selected unused baselines after confirming` |
| 03 | `› ranks unstable screens: flips first…`, `› does not call a change a flip when the baseline changed in between` |
| 04 | `› ranks screens by their newest accessibility issues…` |
| 05 | `› points at noise, early screenshots and hidden changes` |
| 06 | `› lists the checks each device is missing on the main branch` |
| 07 | `› counts reviews waiting for a decision…` |
| 08 | `› judges only the history that is left when older builds were removed` |
| 01 | `frontend/integration_tests/test/insights.spec.ts › asks for the period it shows` |
