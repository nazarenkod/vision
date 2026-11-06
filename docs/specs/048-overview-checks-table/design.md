# 048 — Дизайн

## Підхід

- **Дані** (`backend/src/builds/build-overview.ts`): рядок фічі (`grouped: true`) отримує
  додавальне поле `checks` — перевірки фічі за назвою, з результатом і багами, зведеними за всіма
  пристроями, спершу ті, що чекають рішення (той самий порядок, що й рядки фіч). Звіт і публічне
  посилання поле ігнорують.
- **Overview** (`frontend/src/components/BuildOverview/index.tsx`): одна картка `overviewTable` із
  колонками «Перевірка · Результат · Баги». Фіча — рядок-група: стрілка (розгорнути/згорнути),
  назва жирним і «· N перевірок» (клік — черга фічі, якщо є що вирішувати), зведений результат,
  баги; під нею — рядки її перевірок з відступом. Перевірка без фічі — звичайний рядок із повною
  назвою, що переноситься. Розгорнуті за замовчуванням групи, де щось чекає, відхилене чи з багами;
  клік стрілки перемикає. Клік перевірки: є знімки на рішення → черга фічі (для перевірки в фічі)
  або черга перевірки, починаючи з її знімка; інакше — її перший знімок. Картки «Пристрої» немає;
  картки багів без багів немає.
- **Шапка збірки** (`frontend/src/components/BuildDetails.tsx`): другий рядок — час і тривалість,
  роздільник, `BuildDevices` (набір `DeviceTags` на профіль, кнопка відкриває чергу пристрою або
  його перший знімок). `ProjectPage` передає їх з тих самих даних огляду на всіх вкладках.
- **Заголовок порівняння** (`TestDetailsDialog/TestDetailsModal.tsx`): назва — до 2 рядків
  (`-webkit-line-clamp`), повна — у `title`; висота заголовка фіксована 64 px.

## Компоненти

| Компонент | Шлях | Роль |
|---|---|---|
| Дані огляду | `backend/src/builds/build-overview.ts` | `checks` у рядку фічі |
| Огляд | `frontend/src/components/BuildOverview/index.tsx` | одна таблиця, групи фіч, `BuildDevices` |
| Шапка збірки | `frontend/src/components/BuildDetails.tsx`, `frontend/src/pages/ProjectPage.tsx` | пристрої після часу |
| Заголовок порівняння | `frontend/src/components/TestDetailsDialog/TestDetailsModal.tsx` | повна назва до 2 рядків |

## Дані

`FeatureRow.checks?: FeatureRow[]` у відповіді `GET /builds/:id/overview` — нове необов'язкове
поле; міграцій немає.

## Ризики

| Ризик | Що робимо |
|---|---|
| Старий сервер не віддає `checks` | група показує «· N перевірок» за `total` і розгортається порожньою |
| Тести й тур спираються на таблицю фіч, блок пристроїв, рядок без багів | переписуємо під нові вимоги |
| Скриншот-еталони огляду, шапки збірки й порівняння змінюються | перегенеровуємо в Docker і переглядаємо |

## Перевірка вимог

| Вимога | Перевірка |
|---|---|
| REQ-048-01 | `frontend/integration_tests/test/buildOverview.spec.ts › has the columns Check, Result and Bugs only` |
| REQ-048-02 | `backend/src/builds/build-overview.spec.ts › lists the checks of a feature with their results over all devices, waiting first`; `frontend/integration_tests/test/buildOverview.spec.ts › groups the checks of a feature under it with their results` |
| REQ-048-03 | `frontend/integration_tests/test/buildOverview.spec.ts › shows a check without a feature as a plain row with its whole name` |
| REQ-048-04 | `frontend/integration_tests/test/buildOverview.spec.ts › opens a feature with changes and folds one without them` |
| REQ-048-05 | `frontend/integration_tests/test/buildOverview.spec.ts › opens a check in its feature's queue and a decided one on its own` |
| REQ-048-06 | `frontend/integration_tests/test/buildOverview.spec.ts › shows the devices of the build in its header on every tab`; `frontend/integration_tests/test/buildOverview.spec.ts › opens the queue of a device from the build header` |
| REQ-048-07 | `frontend/integration_tests/test/buildOverview.spec.ts › shows no Jira bugs card when the build has none` |
| REQ-048-08 | `frontend/integration_tests/test/compareLayout.spec.ts › shows the whole check name in up to two lines at one header height` |
