# 047 — Дизайн

## Підхід

Лише фронтенд, без нових даних.

- **Overview** (`frontend/src/components/BuildOverview/index.tsx`): сітка карток стає колонкою —
  фічі на всю ширину, далі невеликий рядок карток «Пристрої» і «Баги Jira», далі доступність.
  Таблиця пристроїв замінюється блоком `OverviewDevices`: `DeviceTags` кожного профілю, кнопкою,
  що відкриває чергу пристрою тим самим обробником, що й рядок таблиці раніше. Колонку пристрою
  з картки доступності прибрано. Звіт (`BuildReport/`) не чіпаємо.
- **Заголовок порівняння** (`TestDetailsDialog/TestDetailsModal.tsx`): `StepProgress` і
  `QueueHeader` у заголовку не рендеряться; черга в адресі й навігація стрілками лишаються
  (`reviewQueue.helper.ts`). Якщо `StepProgress` і меню черг більше ніде не потрібні — видаляються
  разом із тестами й ключами словника.
- **Частка змін** (`TestDetailsDialog/DiffMeter.tsx`): лише текст «змінено N% · дозволено M%»,
  N кольором `tokens.status.failed.fg`, коли N > M; шкали немає.

## Компоненти

| Компонент | Шлях | Роль |
|---|---|---|
| Огляд | `frontend/src/components/BuildOverview/index.tsx` | колонка карток, блок пристроїв, доступність без пристрою |
| Заголовок порівняння | `frontend/src/components/TestDetailsDialog/TestDetailsModal.tsx` | без позиції й черги |
| Частка змін | `frontend/src/components/TestDetailsDialog/DiffMeter.tsx` | лише текст |

## Дані

Немає.

## Ризики

| Ризик | Що робимо |
|---|---|
| Тести й тур спираються на `queuePosition`, меню черг, таблицю пристроїв | переписуємо їх під нові вимоги; черга в адресі перевіряється, як і була |
| Скриншот-еталони порівняння й огляду змінюються | перегенеровуємо в Docker і переглядаємо |

## Перевірка вимог

| Вимога | Перевірка |
|---|---|
| REQ-047-01 | `frontend/integration_tests/test/buildOverview.spec.ts › shows the features across the whole page with whole names` |
| REQ-047-02 | `frontend/integration_tests/test/buildOverview.spec.ts › shows the devices of the build in its header on every tab` |
| REQ-047-03 | `frontend/integration_tests/test/buildOverview.spec.ts › opens the queue of a device from the build header` |
| REQ-047-04 | `frontend/integration_tests/test/buildOverview.spec.ts › lists accessibility problems without the device` |
| REQ-047-05 | `frontend/integration_tests/test/compareLayout.spec.ts › shows neither the position nor the queue in the header` |
| REQ-047-06 | `frontend/src/components/TestDetailsDialog/DiffMeter.test.tsx › says the changed share against the allowed one in words` |
