# 019 — Дизайн

## Підхід

**Сторінка.** `/projects/:projectId/settings/:tab` (`general`, `comparison`, `mobile`,
`accessibility`, `jira`) замість діалогу «Update Project» (REQ-019-01, REQ-019-02). Чернетка —
`projectEditState` проєктного контексту, як і раніше: підформи бібліотек порівняння
(`useConfigHook`) працюють з ним без змін. Сторінка кладе туди проєкт при відкритті й порівнює з
ним для «є незбережені зміни» (REQ-019-20). Збереження — той самий `PUT /projects`, тож значення
й їхній зміст не змінюються (REQ-019-23); токен Jira — як раніше, лише запис (REQ-019-24).

**Незбережені зміни.** `useBlocker` React Router працює лише з data router, тому `index.tsx`
переходить з `<BrowserRouter>` на `createBrowserRouter` з одним маршрутом `*`, який рендерить
`App`; вкладені `<Routes>` лишаються як є. Блокер показує діалог «Піти без збереження?», а
`beforeunload` — системне попередження браузера (REQ-019-21).

**Перевірка полів** — чиста функція `validateProject(project)` → `{ поле: ключ помилки }` і
`tabOf(поле)`. «Зберегти» з помилками не надсилає запит, позначає вкладки й переходить до
першого поля з помилкою (REQ-019-22). Селектори й шаблони перевіряються тими ж функціями, що й
зараз (`patternError`, `parseSelector`-сумісний вираз) (REQ-019-17).

**Рядок налаштування** `SettingRow`: назва, пояснення «що зміниться», чип «Типово: …» і кнопка
«Повернути типове», якщо значення відрізняється (REQ-019-03, REQ-019-04). Типові значення —
`PROJECT_DEFAULTS` (з `schema.prisma`) і `DEFAULT_UI_TREE_SETTINGS`. Варіанти виборів — з
людськими назвами й описами в словнику (REQ-019-05), залежні поля ховаються (REQ-019-06), режими
«та сама проблема» мають приклади «одна проблема / різні» (REQ-019-07).

**Словник проєкту** (REQ-019-10). `GET /projects/:id/vocabulary` — лише читання:

1. `testRun.findMany` проєкту за 30 днів з `uiTreeName`, `distinct testVariationId`, найновіші,
   не більше 300.
2. Дерева — через `UiTreeService.load` (кеш).
3. Чиста функція `projectVocabulary(entries, screenTitleSelectors)` у
   `backend/src/ui-tree/project-vocabulary.ts` повертає:
   - `screens` — назви екранів (заголовок за поточними селекторами, інакше назва перевірки — так
     само, як екран проблеми доступності);
   - `elements` — `{ selector, id, className, text, label, screens: індекси екранів }`, об'єднані за
     `selector`+`className`, до 3000, від найчастіших; `selector` — той, що правило використовує
     (`selectorForNode`);
   - `classes` — короткі імена класів з кількістю екранів;
   - `titleCandidates` — до 5 селекторів елементів з id у верхніх 25 % екрана, що дають
     заголовок щонайменше на 30 % екранів і різний хоча б на двох; з кількістю екранів і до 5
     прикладів назв (через ту саму `screenTitle`) (REQ-019-12).

Пошук елемента для правила, підказки умов класів і лічильник охоплення рахуються у браузері по
цьому словнику (REQ-019-11, REQ-019-13, REQ-019-14). Охоплення класу — та сама семантика, що в
`classOf` на сервері: поле порожнє — не обмежує; у полі будь-який шаблон; glob без урахування
регістру або `/regex/`. Порт `compilePattern` — у `frontend/src/components/ProjectSettings/patterns.ts`.

Еталонний пристрій: `GET /projects/:id/devices` вже сортує за кількістю перевірок; перший
позначаємо «рекомендовано» (REQ-019-15). Порожній словник → вільне введення з прикладами й
пояснення (REQ-019-16).

**Створення** (REQ-019-30): діалог лише з назвою й гілкою, `POST /projects` з типовими
значеннями, далі перехід на сторінку налаштувань нового проєкту.

## Компоненти

| Компонент | Шлях | Роль |
|---|---|---|
| Словник проєкту | `backend/src/ui-tree/project-vocabulary.ts` | чиста функція: екрани, елементи, класи, кандидати на заголовок |
| API | `backend/src/projects/projects.controller.ts`, `projects.service.ts` | `GET /projects/:id/vocabulary` |
| Тип і сервіс | `frontend/src/types/insights.ts`, `frontend/src/services/projects.service.ts` | `ProjectVocabulary`, `getVocabulary` |
| Сторінка | `frontend/src/pages/ProjectSettingsPage.tsx` | вкладки, збереження, блокер |
| Вкладки | `frontend/src/components/ProjectSettings/*Tab.tsx` | загальне, порівняння, мобільні, доступність, Jira |
| Спільне | `frontend/src/components/ProjectSettings/SettingRow.tsx`, `ElementPicker.tsx`, `patterns.ts`, `validation.ts`, `defaults.ts` | рядок налаштування, пошук елемента, шаблони, перевірка, типові |
| Список проєктів | `frontend/src/pages/ProjectListPage.tsx` | олівець → сторінка; короткий діалог створення |
| Роутер | `frontend/src/index.tsx`, `frontend/src/Router.jsx`, `frontend/src/constants/routes.ts` | data router, маршрут налаштувань |

Старі `ProjectForm.tsx` і `A11yProblemSettings.tsx` видаляються; форми параметрів бібліотек
(`*ConfigForm.tsx`) лишаються й перекладаються.

## Дані

Схема бази не змінюється. Налаштування зберігаються в тих самих полях проєкту (`uiTreeSettings`
JSON тощо).

## Ризики

| Ризик | Що робимо |
|---|---|
| Словник повільний на великому проєкті | 300 дерев максимум, кеш дерев сервісу; запит лише при відкритті вкладок «Мобільні» й «Доступність» |
| Розбіжність охоплення класу в браузері й на сервері | порт `compilePattern` з тими ж тестовими випадками |
| Перехід на data router зачепить інші сторінки | маршрути не змінюються, лише обгортка; весь набір Playwright |

## Перевірка вимог

| Вимога | Перевірка |
|---|---|
| REQ-019-01 | `frontend/integration_tests/test/projectSettings.spec.ts › opens the settings page from the project list` |
| REQ-019-02 | `frontend/integration_tests/test/projectSettings.spec.ts › keeps the tab in the address` |
| REQ-019-03 | manual: на кожній вкладці біля кожного налаштування є пояснення наслідку |
| REQ-019-04 | `frontend/src/components/ProjectSettings/SettingRow.test.tsx › offers the default back once the value differs` |
| REQ-019-05 | `frontend/integration_tests/test/projectSettings.spec.ts › names the variation axes for people` |
| REQ-019-06 | `frontend/integration_tests/test/projectSettings.spec.ts › shows the move limit only with moves compared` |
| REQ-019-07 | manual: вкладка «Доступність» показує приклад для кожного режиму «та сама проблема» |
| REQ-019-10 | `backend/src/ui-tree/project-vocabulary.spec.ts › lists the elements, classes and screens of the trees with how often they occur` |
| REQ-019-11 | `frontend/integration_tests/test/projectSettings.spec.ts › adds an element rule by searching the project's elements` |
| REQ-019-12 | `backend/src/ui-tree/project-vocabulary.spec.ts › suggests the title selector that names most screens differently` |
| REQ-019-13 | `frontend/src/components/ProjectSettings/patterns.test.ts › suggests values of the project for a class condition` |
| REQ-019-14 | `frontend/src/components/ProjectSettings/patterns.test.ts › counts the elements and screens a class takes` |
| REQ-019-15 | `frontend/integration_tests/test/projectSettings.spec.ts › marks the device with most checks as recommended` |
| REQ-019-16 | `frontend/integration_tests/test/projectSettings.spec.ts › explains where suggestions come from when there are none` |
| REQ-019-17 | `frontend/src/components/ProjectSettings/validation.test.ts › reports a pattern that does not compile` |
| REQ-019-20 | `frontend/integration_tests/test/projectSettings.spec.ts › saves every tab with one save` |
| REQ-019-21 | `frontend/integration_tests/test/projectSettings.spec.ts › warns before leaving with unsaved changes` |
| REQ-019-22 | `frontend/integration_tests/test/projectSettings.spec.ts › does not save and marks the tab with an error` |
| REQ-019-23 | `frontend/integration_tests/test/projectSettings.spec.ts › saves every tab with one save` |
| REQ-019-24 | `frontend/integration_tests/test/projectSettings.spec.ts › keeps a saved Jira token without showing it` |
| REQ-019-30 | `frontend/integration_tests/test/projectList.spec.ts › creates a project and opens its settings` |
