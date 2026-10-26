# backend — NestJS 11 + Prisma 6 + Postgres

Загальні правила — у [../AGENTS.md](../AGENTS.md). Тут лише те, що стосується бекенду.

## Модулі Vision

| Модуль | Відповідає за | Специфікація |
|---|---|---|
| `src/ui-tree/` | розбір Appium page source, налаштування порівняння, правила елементів, приховані зміни, «знято зарано», «не той екран», групи компонентів, довідкове порівняння пристроїв | [002](../docs/specs/002-ui-tree-analysis/spec.md), [007](../docs/specs/007-cross-device-reference/spec.md) |
| `src/a11y/a11y.rules.ts` | правила доступності | [003](../docs/specs/003-accessibility-checks/spec.md) |
| `src/a11y/a11y-problems.ts`, `a11y-issues*.ts` | проблеми, їхні ID і факти, класи, маркери, рішення, пошук у Jira | [004](../docs/specs/004-a11y-problems/spec.md) |
| `src/a11y/jira*.ts` | клієнт Jira, поля й текст бага | [005](../docs/specs/005-jira-bugs/spec.md) |
| `src/test-runs/change-groups.service.ts` | групи змін збірки | [006](../docs/specs/006-change-groups/spec.md) |
| `src/analytics/` | Insights | [008](../docs/specs/008-insights/spec.md) |
| `src/ai/` | AI на вимогу, кеш, ліміт | [010](../docs/specs/010-ai-assist/spec.md) |
| `src/compare/` | піксельне порівняння (upstream + області змін, пул воркерів) | — |

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
  Unit-тест «asks for the siblings signatures at once» інколи падає під навантаженням, окремо
  проходить.
- `parseUiTreeSettings` відкидає записи, яких не розуміє. Додаючи поле в налаштування проєкту,
  онови й парсер, і його тест (`comparison-inputs.spec.ts`).
- Кеш індексу проблем (`A11yIssuesService.indexFor`) скидається після кожного запису в цьому
  сервісі. Пишеш в `A11yProblem` деінде — виклич `forget(projectId)` або перевір версію.
