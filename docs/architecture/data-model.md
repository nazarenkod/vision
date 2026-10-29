# Модель даних

Схема: `backend/prisma/schema.prisma`. Усі зміни Vision відносно upstream — додавальні
([ADR-0003](../decisions/0003-additive-schema-only.md)), тож Vision працює на копії бази
upstream VRT, а згодом зможе працювати й на живій.

## Таблиці upstream з доповненнями Vision

| Таблиця | Що додано | Навіщо |
|---|---|---|
| `TestRun` | `uiTreeName`, `baselineUiTreeName`, `uiTreeOptions`, `a11yReportName`, `a11yNewCount`, `a11yTotalCount`, `diffRegions`, `changeSignature`, `imageThumbnailName`, `diffThumbnailName`, `captureWarnings`, `semanticChangeCount`, `componentChanges` | результати аналізу дерева: файли й лічильники |
| `TestVariation`, `Baseline` | `baselineUiTreeName` / `uiTreeName` | дерево еталона йде разом із картинкою |
| `Project` | `jiraUrl`, `jiraToken` (спільний, необов'язковий), `jiraEmail`, `jiraIssueType`, `jiraLinkType`, `uiTreeSettings` (JSON); `bulkApproveVariations`, `bulkApproveGroupBy` — від прибраних груп варіацій ([022](../specs/022-remove-variation-groups/spec.md)), лишаються в рядку, але не читаються й не віддаються API | Jira і налаштування мобільного порівняння, заголовок екрана |
| `User` | `jiraToken`, `jiraEmail`, `lastSignInAt` | особистий токен Jira ([ADR-0010](../decisions/0010-personal-jira-tokens.md)); останній вхід в інтерфейс паролем чи SSO, для сторінки Users ([018](../specs/018-ui-redesign/spec.md)) |

`uiTreeSettings` — JSON, який читає `parseUiTreeSettings` (`ui-tree/comparison-inputs.ts`):
системні бари, зсуви, приховані зміни, «знято зарано», «не той екран», правила елементів,
еталонний пристрій, `screenTitle` (селектори заголовка). Биті записи парсер відкидає, а поля,
яких він не знає, лишає як є: так `a11yDuplicates` і `a11yClasses`, які до
[021](../specs/021-fixed-a11y-grouping/spec.md) задавали групування проблем, переживають збереження,
але ніхто їх не читає.
Правило елемента має дію `ignore`, `tolerate` або `compare`; `compare` («порівнювати лише»,
[015](../specs/015-compare-selected-elements/spec.md)) лежить лише в `checkRules` перевірки.

## Нові таблиці

| Таблиця | Що зберігає |
|---|---|
| `A11yProblem` | проблема доступності на проєкт: `code` (ID, не змінюється), `key` (ключ на момент створення, він же «замок»; унікальний з `projectId`), `facets` (факти місць, для яких її вирішили), `status` (`filing` / `reported` / `ignored`), Jira-ключ і посилання, де вирішили ([004](../specs/004-a11y-problems/spec.md)) |
| `A11yDecision` | журнал рішень: `filed`, `linked`, `found`, `unlinked`, `ignored`, `restored` — хто, коли, по якій проблемі та якому багу |
| `A11yIssueState` | рішення старого формату (по елементу на екрані). При старті API переносяться в `A11yProblem`; ті, чиє порушення вже не знайдено, діють як раніше на своєму екрані |
| `CrossDeviceCheck` | що показало довідкове порівняння пристроїв і що вирішив рев'юер ([007](../specs/007-cross-device-reference/spec.md)) |
| `AiResult` | кеш відповідей AI за хешем вмісту ([010](../specs/010-ai-assist/spec.md)) |
| `ReviewDecision` | журнал Approve і Reject для Undo: хто, що (`kind`), стан кожного прогону до й після (`items`, JSON), коли скасовано (`undoneAt`). Без зовнішніх ключів; записи старші за 7 днів видаляються при наступному записі ([ADR-0014](../decisions/0014-undo-through-decision-journal.md)) |

## Файли (`imageUploads` або S3)

| Файл | Що |
|---|---|
| `*.png` | скриншоти, діфи, мініатюри (upstream) |
| `<id>.uitree.json.gz` | розібрані UI-дерева знімків і еталонів: нормалізовані вузли, межі в пікселях скриншота |
| `<id>.a11y.json` | звіт доступності знімка: порушення зі статусом нове / наявне, виправлені, заголовок екрана й селектори, якими його знайшли |

## Файли бекапу (на хості, [013](../specs/013-backups-and-secrets/spec.md))

| Файл | Що |
|---|---|
| `demo-data/backups/vision-<UTC>.tar` | бекап: `db.dump` (без рядків `User` і `Project`), `user.csv`, `project.csv` (без паролів і токенів Jira), `manifest.txt` (схема й кількість рядків); `.uploaded` поруч — уже в Google Drive; `vision-<UTC>.images.txt` — перелік картинок на момент бекапу (за ним чистяться картинки в Drive) |
| `demo-data/backup-status/status.json` | стан останнього бекапу (і `runningSince`, поки йде); API читає його як `BACKUP_STATUS_FILE` |
| `demo-data/backup-config/` | пише API зі сторінки Backups ([017](../specs/017-backup-settings-ui/spec.md)): `drive.json` і `rclone.conf` (600, секрети підключення), `settings.json`, `backup-requested` |

## Міграції

`backend/prisma/migrations/`, пишуться руками. Міграції Vision:

| Міграція | Що |
|---|---|
| `20260904120000_add_test_run_change_signature`, `…140000_add_test_run_thumbnails` | групи змін, мініатюри |
| `20261024120000_add_ui_tree_and_ai_results` | дерева, звіти, `AiResult` |
| `20261024150000_add_jira_and_a11y_issue_states` | Jira у проєкті, `A11yIssueState` |
| `20261025090000_add_ui_tree_comparison` | налаштування порівняння, попередження, приховані зміни |
| `20261025120000_add_cross_device_checks` | `CrossDeviceCheck` |
| `20261026090000_add_a11y_problems` | `A11yProblem` |
| `20261026100000_add_user_jira` | особистий токен Jira |
| `20261026110000_add_a11y_problem_facts_and_decisions` | факти проблем, `A11yDecision` |
| `20261029100000_add_user_last_sign_in` | `User.lastSignInAt` |
| `20261029110000_add_review_decisions` | `ReviewDecision` |
