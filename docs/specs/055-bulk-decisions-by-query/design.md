# 055 — Дизайн

## Підхід

- **Що змінилось на екрані** — те саме, що показує вкладка «Зміни»: `UiTreeService.elementChanges`
  (`backend/src/ui-tree/ui-tree.service.ts`) бере обидва дерева, `diffRegions` з елементом навколо
  кожного місця (`elementsUnderRegions`) і зміни дерева після правил (`diffTrees`, `outsideAreas`,
  `insideCompared`).
- **Чиста функція** `elementReview` (`backend/src/test-runs/element-review.ts`): ключі змінених
  елементів кожного екрана (зсув не рахується), лише `id:` (інші ключі не впізнати на іншому
  екрані), «лише він» — коли немає місця без елемента й змінений ключ один. Елементи з ≥ 2 екранів,
  спершу найчастіші; у картці — рамки елемента в обох деревах і розміри дерев для вирізки.
- **Сервіс і маршрут.** `ChangeGroupsService.elementReview` вантажить екрани збірки зі статусом
  `unresolved`, еталоном і обома деревами (по 8 одночасно) — `GET /test-runs/elements?buildId=`,
  `@ProjectFrom(inQuery('buildId', 'build'))`. Нових таблиць немає.
- **Рішення** — наявні `POST /test-runs/approve` і `/reject` з переліком: один запис
  `ReviewDecision`, наявне Undo (ADR-0014).
- **Інтерфейс.** `ChangesTab` (`frontend/src/components/ElementReview.tsx`) — перемикач «Екрани /
  Елементи» з «Бета», режим у адресі (`by=elements&element=<ключ>`). Ліворуч — перелік елементів,
  праворуч — картки з двома вирізками (`ElementCrop`, спільна з 053). Позначки — множина знятих;
  у рішення йдуть лише «лише він» без знятих (`decidedScreens`). ⇧A — `isApproveHotkey`.
- **Вхід із порівняння.** `useBuildElements` (`frontend/src/components/useBuildElements.ts`) один
  раз на збірку питає елементи; рядок зміни знає ключ свого елемента (`ChangeRow.nodeKey`) і
  показує «ще N екранів →», що веде на вкладку «Зміни» в режимі «Елементи».

## Компоненти

| Компонент | Шлях | Роль |
|---|---|---|
| Чиста функція | `backend/src/test-runs/element-review.ts` | елементи, екрани, «лише він», рамки |
| Зміни екрана | `backend/src/ui-tree/ui-tree.service.ts` | `elementChanges` |
| Сервіс | `backend/src/test-runs/change-groups.service.ts` | `elementReview(buildId)` |
| Маршрут | `backend/src/test-runs/test-runs.controller.ts` | `GET /test-runs/elements` |
| Вкладка | `frontend/src/components/ElementReview.tsx` | `ChangesTab`, `ElementReview` |
| Хелпер | `frontend/src/_helpers/elementReview.helper.ts` | `decidedScreens`, `isApproveHotkey` |
| Вирізка, «Бета» | `frontend/src/components/ElementCrop.tsx`, `frontend/src/components/BetaChip.tsx` | спільні з 053 |
| Порівняння | `frontend/src/components/TestDetailsDialog/InsightsPanel.tsx`, `frontend/src/components/TestDetailsDialog/changedAreas.ts`, `frontend/src/components/useBuildElements.ts` | чип «ще N екранів» |
| Сторінка збірки | `frontend/src/pages/ProjectPage.tsx` | `ChangesTab` замість `ChangeGroups` |

## Дані

Нічого нового в базі. Відповідь: `[{ key, name, screens, only, items: [{ id, name, customTags,
device, os, browser, viewport, imageName, baselineName, merge, only, current, baseline, width,
height, baselineWidth, baselineHeight }] }]`; `imageName` і `baselineName` підписує
`FileLinksInterceptor` (043).

## Ризики

| Ризик | Що робимо |
|---|---|
| Повільно на великій збірці (усі дерева) | паралельність 8, кеш дерев `UiTreeService.load`; у порівнянні — один запит на збірку |
| Прийняти зайве | у рішення йдуть лише екрани «лише він»; Undo всієї пачки |
| Однаковий id різних елементів (`#1`, `#2`) | ключ із номером — окремий елемент |

## Перевірка вимог

| Вимога | Перевірка |
|---|---|
| REQ-055-01 | `frontend/integration_tests/test/elementReview.spec.ts › shows the elements changed on several screens, most first` |
| REQ-055-02 | `backend/src/test-runs/element-review.spec.ts › puts the element changed on most screens first`; `backend/src/test-runs/element-review.spec.ts › leaves out an element on one screen and keys that do not cross screens`; `backend/src/test-runs/change-groups.service.spec.ts › asks for screens waiting for a decision with both trees and reviews what they changed` |
| REQ-055-03 | `backend/src/test-runs/element-review.spec.ts › counts a change of the tree and leaves a move alone`; `backend/src/test-runs/element-review.spec.ts › gathers one element changed differently on several screens` |
| REQ-055-04 | `backend/src/test-runs/element-review.spec.ts › marks a screen where something else changed too as not decided by the element` |
| REQ-055-05 | `frontend/integration_tests/test/elementReview.spec.ts › shows the elements changed on several screens, most first` |
| REQ-055-06 | `frontend/src/_helpers/elementReview.helper.test.ts › decides only the ticked screens where nothing else changed`; `frontend/integration_tests/test/elementReview.spec.ts › shows the elements changed on several screens, most first` |
| REQ-055-07 | `frontend/integration_tests/test/elementReview.spec.ts › approves the ticked screens of an element with undo`; `frontend/src/_helpers/elementReview.helper.test.ts › approves with shift and A outside a field` |
| REQ-055-08 | `frontend/integration_tests/test/elementReview.spec.ts › approves the ticked screens of an element with undo` |
| REQ-055-09 | `frontend/integration_tests/test/elementReview.spec.ts › offers the other screens of a changed element from the comparison` |
| REQ-055-10 | `frontend/integration_tests/test/elementReview.spec.ts › says so when no element changed on more than one screen` |
| REQ-055-11 | `frontend/src/i18n/translate.test.ts › has every text in both languages…` |
| REQ-055-12 | `backend/src/projects/project-access.routes.spec.ts › answers not found on every route of a project without access` |
