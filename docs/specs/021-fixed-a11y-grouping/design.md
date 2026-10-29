# 021 — Дизайн

## Підхід

Групування вже обчислюється чистою функцією з фактів знахідки (`problemKeyOf`,
[ADR-0008](../../decisions/0008-stable-problem-ids-from-facts.md)). Налаштування проєкту були лише
її другим аргументом. Прибираємо цей аргумент і все, що його живить:

- **Бекенд, чиста логіка.** У `a11y-problems.ts` лишаються факти, ключ проблеми, ID, маркери й
  заголовок екрана. Зникають класи (`ProblemClass`, `classOf`, `compilePattern`, `groupByOf`),
  налаштування (`ProblemSettings`, `duplicateModeOf`) і режим `class`. Таблиця
  `DEFAULT_DUPLICATE_MODES` стає єдиним правилом групування (REQ-021-03…06). Параметр
  `settings` зникає з `problemKeyOf`, `readingOf`, `problemMarkers`, `markerQuery`,
  `indexProblems` і `ReviewContext`.
- **Механізм «ID і баги лишаються» не чіпаємо.** Проблеми зберігають факти, індекс будується з
  фактів за поточним правилом. Проблема, вирішена за класом чи іншим режимом, розкладається за
  фіксованим правилом і тримає ID і баг у кожній частині (REQ-021-08, як у спеці 004). Цей самий
  механізм знадобиться для поправок з картки.
- **Бекенд, сервіс.** `A11yIssuesService` більше не читає `a11yDuplicates` і `a11yClasses`
  (REQ-021-07). Зникає відмова заводити баг на проблему, яку ігнорує клас зі спеки 004, і знахідка
  стає звичайною (REQ-021-09).
- **Збережені значення не стираємо.** Обидва парсери налаштувань (`parseUiTreeSettings` на бекенді
  й фронтенді) розгортають `...parsed`, тож поля, яких тип більше не знає, переживають збереження
  сторінки без змін. Ми їх просто не читаємо (поза межами спеки: видалення з бази).
- **Фронтенд.** `A11yProblemSettings` лишає поле заголовка екрана й одне пояснення правила
  (REQ-021-01/02). З пошуку «Find a setting» зникають мітки режимів і правил. У списку розділів
  «0 classes» замінюється кількістю селекторів заголовка. У панелі доступності зникає плашка класу
  й умова `byClass`.

Нового ADR не треба: рішення ADR-0008 (ID з фактів, ключ за поточним правилом) лишається
чинним, змінюється лише те, звідки береться правило. В ADR-0008 додаємо примітку з посиланням на 021.

## Компоненти

| Компонент | Шлях | Роль |
|---|---|---|
| Ідентичність проблем | `backend/src/a11y/a11y-problems.ts` | фіксоване правило групування; без класів і налаштувань; маркери без мітки класу (REQ-021-10) |
| Застосування рішень | `backend/src/a11y/a11y-issues.ts` | `indexProblems`, `reviewReport` без налаштувань; без `byClass` і `problemClass` |
| Сервіс проблем | `backend/src/a11y/a11y-issues.service.ts` | не читає режими й класи; без відмови «клас ігнорує»; JQL і пошук бага без налаштувань |
| Налаштування дерева | `backend/src/ui-tree/comparison-inputs.ts` | тип і парсер без `a11yDuplicates`, `a11yClasses` |
| Розділ налаштувань | `A11yProblemSettings` (з [026](../026-a11y-rules-settings/spec.md) — `frontend/src/components/ProjectForm/A11yRulesSettings.tsx`) | лише заголовок екрана й пояснення; з 026 — лише правила з нормами |
| Пошук і зміст | `frontend/src/_helpers/projectSettings.helper.ts`, `frontend/src/pages/ProjectSettingsPage.tsx` | мітки розділу й підпис у змісті |
| Типи | `frontend/src/types/insights.ts` | без `ProblemClass`, `DuplicateMode`, `GroupBy`, `byClass`, `problemClass` |
| Панель доступності | `frontend/src/components/TestDetailsDialog/InsightsPanel.tsx` | без плашки класу й умови `byClass` |

## Дані

Схема не змінюється. `Project.uiTreeSettings` (JSON) може містити `a11yDuplicates` і
`a11yClasses`. Вони лишаються в рядку, їх ніхто не читає й не пише. Мітки `a11y-class-…` на вже
заведених багах у Jira лишаються. Баги знаходяться за ID проблеми, як і раніше.

Перевірка припущення спеки (ніхто не має режимів і класів) — на копії даних проду, лише читання:
`SELECT id, name FROM "Project" WHERE "uiTreeSettings" ~ '"a11y(Duplicates|Classes)":\s*(\{[^}]|\[[^\]])'`.
Порожній результат означає, що граничні випадки спеки лишаються теоретичними.

## Потік

Без змін, крім одного кроку: `знахідка → факти → problemKeyOf(факти) → індекс проблем за тим самим
ключем → рішення`. Раніше `problemKeyOf` брав ще й налаштування проєкту.

## Ризики

| Ризик | Що робимо |
|---|---|
| Паралельні сесії 020 (еталонний пристрій) і 022 (групи варіацій) правлять ті самі файли: `comparison-inputs.ts`, `insights.ts`, `projectSettings.helper.ts`, `ProjectSettingsPage.tsx`, `projectSettings.spec.ts`, `data-model.md`, `glossary.md` | Правимо лише свої рядки, без переформатування; перед комітом дивимось `git diff` цих файлів і комітимо лише свої зміни (`git add -p`) |
| Проєкт усе ж мав клас Ignore → знахідки з'являться як нові й можуть «завалити» збірку | Перевірка на копії даних (розділ «Дані»); якщо такі є, кажемо людині до релізу |
| Прибраний параметр `settings` десь передається позиційно й мовчки ігнорується | `tsc --noEmit` для бекенду й фронтенду; параметр видаляємо, а не робимо необов'язковим |
| Трасування 004 і 018 посилається на тести, які зникнуть | Переводимо вимоги класів у 004 і нумерацію класів у 018 на `manual: знято 021`; перейменовані тести оновлюємо в трасуванні |

## Перевірка вимог

| Вимога | Перевірка |
|---|---|
| REQ-021-01 | `frontend/integration_tests/test/projectSettings.spec.ts › shows only the rules under Accessibility`; `frontend/src/_helpers/projectSettings.helper.test.ts › finds nothing about grouping, problem classes or the screen title` |
| REQ-021-02 | змінено в [026](../026-a11y-rules-settings/spec.md): `frontend/integration_tests/test/projectSettings.spec.ts › shows only the rules under Accessibility` |
| REQ-021-03 | `backend/src/a11y/a11y-problems.spec.ts › is one problem for the same component and tap area on any screen` |
| REQ-021-04 | `backend/src/a11y/a11y-problems.spec.ts › is one problem for the same component on any screen when the rule measures nothing` |
| REQ-021-05 | `backend/src/a11y/a11y-problems.spec.ts › keeps the same label a problem of its own screen` |
| REQ-021-06 | `backend/src/a11y/a11y-problems.spec.ts › keeps ids apart and makes an element without an id a problem of its screen only` |
| REQ-021-07 | `backend/src/a11y/a11y-problems.service.spec.ts › groups by the fixed rule whatever grouping the project saved before` |
| REQ-021-08 | `backend/src/a11y/a11y-issues.spec.ts › keeps ids and bugs of problems decided under another grouping` |
| REQ-021-09 | `backend/src/a11y/a11y-problems.service.spec.ts › groups by the fixed rule whatever grouping the project saved before` (знахідка під колишнім класом Ignore — нова, заводиться) |
| REQ-021-10 | `backend/src/a11y/a11y-problems.spec.ts › labels a bug with its id, rule, component and values` |
