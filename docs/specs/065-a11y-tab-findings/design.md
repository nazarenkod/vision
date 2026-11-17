# 065 — Дизайн

## Підхід

Проблеми рахує й групує той самий код, що й рев'ю: звіт доступності кожного знімка читається з
файла, на нього накладаються рішення команди (`reviewReport`), а чиста функція
`listedProblemsOf` групує знахідки так само, як панель «Доступність» порівняння групує картки:
та сама проблема (`group`) з тим самим рішенням. Тож рядок на вкладці — це картка в рев'ю
(SC-065-02), а не знахідка на елементі, як на картці «Огляду».

Бекенд віддає список одним запитом на збірку, бо вкладка показує всі перевірки одразу. Окремий
маршрут, а не поле в `/builds/:id/overview`: огляд обмежує проблеми двадцятьма й кешує свої
підрахунки, а вкладці потрібні всі й лише коли її відкрили.

Фронтенд вантажить список, коли відкрито вкладку, і ще раз, коли змінюється будь-яке число
доступності знімків збірки. Так список іде за таблицею наживо, як і її числа: заведений баг,
хибна знахідка чи новий знімок збірки, що ще йде. Під рядком знімка — список рядків-кнопок; клік
відкриває порівняння з `issue=<id першої знахідки>` в адресі, а порівняння, щойно звіт
доступності завантажився, обирає цю знахідку тим самим `highlightViolation`, що й клік по картці
([003](../003-accessibility-checks/spec.md)). Один раз на знімок, щоб наступний вибір людини не скасовувався.

## Компоненти

| Компонент | Шлях | Роль |
|---|---|---|
| `listedProblemsOf`, `ListedA11yProblem` | `backend/src/a11y/a11y-issues.ts` | чиста: проблеми переглянутого звіту рядками — правило, елемент (`elementNameOf`), кількість, стан, ключ бага, id першої знахідки; без порад; порядок нові → заведені → відомі, далі правило |
| `A11yIssuesService.problemListsOn` | `backend/src/a11y/a11y-issues.service.ts` | читає звіти знімків з проблемами й переглядає їх, як `findingsOn` |
| `BuildOverviewService.a11yProblems` | `backend/src/builds/build-overview.service.ts` | знімки збірки → списки |
| `GET /builds/:id/a11y-problems` | `backend/src/builds/builds.controller.ts` | маршрут, доступ — як у `/overview` (`@ProjectFrom`) |
| `BuildA11yProblem`, `buildOverviewService.a11yProblems` | `frontend/src/types/buildOverview.ts`, `frontend/src/services/buildOverview.service.ts` | тип і виклик |
| `A11ySummary` → `ProblemList` | `frontend/src/components/A11ySummary.tsx` | список під рядком знімка |
| `issue` в адресі | `frontend/src/_helpers/route.helpers.ts` | `buildTestRunLocation(…, { issue })`, лише разом зі знімком |
| вибір знахідки з адреси | `frontend/src/components/TestDetailsDialog/TestDetailsModal.tsx` | `highlightViolation` після завантаження звіту; картка обраної проблеми — `aria-current` (`InsightsPanel.tsx`) |

## Дані

Нічого нового в базі: звіти лежать у файлах, рішення — в `A11yProblem` / `A11yIssueState`, як і
раніше.

## Потік

1. Вкладка «Доступність» → `GET /builds/:id/a11y-problems`.
2. Сервіс бере знімки збірки з `a11yReportName` і ненульовим `a11yTotalCount`, переглядає кожен
   звіт за поточними нормами й рішеннями, `listedProblemsOf` дає рядки.
3. Таблиця: під рядком знімка — його рядки. Клік → `?…&tab=a11y&issue=<violationId>&testId=…`.
4. Порівняння відкривається на панелі «Доступність» (як у [058](../058-changes-tab-first/spec.md)), обирає знахідку з `issue`.
   Esc повертає на вкладку: адреса закритого порівняння `issue` не несе.

## Ризики

| Ризик | Що робимо |
|---|---|
| Велика збірка: десятки звітів на кожне відкриття вкладки | Читання й перегляд — ті самі, що в огляді, і без зображень; список вантажиться лише на вкладці. Якщо стане повільно — кеш за збіркою, як у огляду |
| Знахідки з `issue` вже немає (звіт перерахували) | Порівняння просто відкривається без обраної проблеми |
| Список і таблиця розходяться, поки йде збірка | Запит повторюється, коли змінюються числа знімків, тобто тоді ж, коли таблиця |

## Перевірка вимог

| Вимога | Перевірка |
|---|---|
| REQ-065-01 | `frontend/integration_tests/test/buildOverview.spec.ts › lists every accessibility problem under its check, new first` |
| REQ-065-02 | `frontend/integration_tests/test/buildOverview.spec.ts › lists every accessibility problem under its check, new first` |
| REQ-065-03 | `backend/src/a11y/a11y-issues.spec.ts › lists one line per problem, new first, the way the review shows one card` |
| REQ-065-04 | `backend/src/a11y/a11y-issues.spec.ts › lists one line per problem, new first, the way the review shows one card` |
| REQ-065-05 | `backend/src/a11y/a11y-issues.spec.ts › lists one line per problem, new first, the way the review shows one card` |
| REQ-065-06 | `backend/src/a11y/a11y-issues.spec.ts › leaves out advice and false positives` |
| REQ-065-07 | `frontend/integration_tests/test/buildOverview.spec.ts › lists every accessibility problem under its check, new first` |
| REQ-065-08 | `frontend/integration_tests/test/buildOverview.spec.ts › opens the review with the problem chosen on the Accessibility tab`; `frontend/integration_tests/test/a11yProblems.spec.ts › opens a screen with the problem chosen on the build's Accessibility tab`; `frontend/src/_helpers/route.helpers.test.ts › opens a run with the accessibility problem chosen on the Accessibility tab` |
| REQ-065-09 | manual: перемкнути мову на English — стани «New»/«Known» і назви правил англійською; тексти беруться з наявних ключів словника, `tsc` не пропускає ключ без перекладу |
