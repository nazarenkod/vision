# backend — NestJS 11 + Prisma 6 + Postgres

Загальні правила — у [../AGENTS.md](../AGENTS.md). Тут лише те, що стосується бекенду.

## Модулі Vision

| Модуль | Відповідає за | Специфікація |
|---|---|---|
| `src/ui-tree/` | розбір Appium page source, налаштування порівняння, правила елементів, приховані зміни, «знято зарано», «не той екран», групи компонентів, довідкове порівняння пристроїв | [002](../docs/specs/002-ui-tree-analysis/spec.md), [007](../docs/specs/007-cross-device-reference/spec.md) |
| `src/a11y/a11y.rules.ts` | правила доступності | [003](../docs/specs/003-accessibility-checks/spec.md) |
| `src/a11y/a11y-problems.ts`, `a11y-issues*.ts` | проблеми, їхні ID і факти, групування, маркери, рішення, пошук у Jira | [004](../docs/specs/004-a11y-problems/spec.md), [021](../docs/specs/021-fixed-a11y-grouping/spec.md) |
| `src/a11y/jira*.ts` | клієнт Jira, поля й текст бага | [005](../docs/specs/005-jira-bugs/spec.md) |
| `src/test-runs/change-groups.service.ts` | групи змін збірки | [006](../docs/specs/006-change-groups/spec.md) |
| `src/test-runs/decision-undo*.ts` | журнал Approve і Reject та Undo з нього ([ADR-0014](../docs/decisions/0014-undo-through-decision-journal.md)); тест відновлення ганяє справжній upstream approve | [018](../docs/specs/018-ui-redesign/spec.md) |
| `src/projects/settings-conflict.ts`, `project-secrets.ts` | збереження налаштувань поверх чужих змін (409), ключ Gemini лише на запис | [018](../docs/specs/018-ui-redesign/spec.md) |
| `src/analytics/` | Insights | [008](../docs/specs/008-insights/spec.md) |
| `src/ai/` | AI на вимогу, кеш, ліміт | [010](../docs/specs/010-ai-assist/spec.md) |
| `src/compare/` | піксельне порівняння (upstream + області змін, пул воркерів) | — |
| `src/backups/` | сторінка Backups: стан бекапу, вхід у Google Drive кодом, розклад і запит на бекап у файлах для `scripts/vision-backup.sh` (ADR-0013) | [013](../docs/specs/013-backups-and-secrets/spec.md), [017](../docs/specs/017-backup-settings-ui/spec.md) |

## Команди

```bash
npm test                                   # unit-тести src/ (те, що ганяємо завжди)
npx tsc --noEmit -p tsconfig.json          # типи; помилки в prisma/test/seed.spec.ts — апстрім, не наші
npx eslint src
npx prettier --write <змінені файли>       # не по всьому src: не чіпаємо чужий код
npx prisma generate                        # після зміни schema.prisma
npm run test:e2e / test:acceptance         # потрібні запущені Postgres і API, див. docs/guides/testing.md
```

## Правила

- **Міграції** пишемо руками в `prisma/migrations/<YYYYMMDDHHMMSS>_<назва>/migration.sql`, лише
  додавальні (нова таблиця, nullable-колонка, індекс), з коментарем, чому це безпечно.
  Після зміни схеми — `npx prisma generate`, а фікстури `User`/`Project` у специфікаціях
  доповнюємо новими полями.
- **Чиста логіка окремо від сервісів.** Правила, ідентичність проблем, текст бага, Insights — це
  чисті функції (`*.ts` без Nest), сервіс лише завантажує дані й викликає їх. Тестуємо чисті
  функції напряму, а сервіси — з моками Prisma і `fetch`.
- **Звіти й дерева — у файлах, у базі — лічильники.** Сокет-шлюз розсилає рядок `TestRun`
  цілком, тож великий JSON у колонку не кладемо.
- **Jira:** усі виклики — через `JiraClient`, від імені того, хто діє (`userId` → особистий токен,
  інакше спільний токен проєкту). Збій міток чи вкладень — попередження у відповіді, а не помилка.
- **Не повертай рядок `User` цілком** (хеш пароля, API-ключ, токен Jira): лише `select` потрібних
  полів або `UserDto`.
- Коментарі пояснюють *чому*, а не *що*.

## Пастки

- `npx jest` без `--projects src` запускає ще e2e й acceptance, і вони падають без бази.
  Один файл — `npm test -- --testPathPattern <шлях>`: голий шлях після `--projects src` jest
  вважає ще одним проєктом і падає з «jest is not defined».
- `parseUiTreeSettings` відкидає записи, яких не розуміє. Додаючи поле в налаштування проєкту,
  онови й парсер, і його тест (`comparison-inputs.spec.ts`).
- Approve upstream змінить щось нове (поле варіації, ще одну таблицю) — онови `decision-undo.ts`;
  `decision-undo.spec.ts` порівнює стан до approve і після undo й про це скаже.
- Кеш індексу проблем (`A11yIssuesService.indexFor`) скидається після кожного запису в цьому
  сервісі. Пишеш в `A11yProblem` деінде — виклич `forget(projectId)` або перевір версію.
