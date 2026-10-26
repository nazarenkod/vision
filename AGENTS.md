# Vision — інструкції для агентів

Vision — внутрішній форк [Visual Regression Tracker](https://github.com/Visual-Regression-Tracker/Visual-Regression-Tracker)
для QA мобільних застосунків (Android «AOS» та iOS, Appium + Selenide). Він додає до піксельного
порівняння аналіз UI-дерева, перевірки доступності, баги в Jira, групи змін, Insights і CLI/MCP
для ручних перевірок.

Цей файл — рівень 0: правила, що діють завжди, і куди йти далі. Деталі читай лише тоді, коли
вони потрібні для задачі (див. «Куди далі»).

## Непорушні правила

1. **Робочий VRT і його база не повинні постраждати за жодних умов.** Vision стоїть поруч із
   продом і працює на копії даних. Будь-яка команда compose — лише через `./scripts/vision.sh`.
   Нові скрипти — за тими ж запобіжниками (`scripts/lib/vision-safety.sh`). Деталі:
   [ADR-0002](docs/decisions/0002-production-is-read-only.md).
2. **Міграції бази — лише додавальні:** нові таблиці або nullable-колонки, без змін enum, без
   видалень і перейменувань. [ADR-0003](docs/decisions/0003-additive-schema-only.md).
3. **SDK = upstream + один необов'язковий параметр** `TestRunOptions.uiTree`. Нічого більше.
   [ADR-0004](docs/decisions/0004-sdk-upstream-plus-ui-tree.md).
4. **Пуш лише в `vision`** (`github.com/nazarenkod/vision`, гілка `mvp/demo` → `main`):
   `git -c http.postBuffer=1048576000 push vision mvp/demo:main`. Remote `origin` — це upstream VRT,
   туди не пушимо ніколи.
5. **Інтерфейс англійською.** Документація для команди — українською, ідентифікатори в коді —
   англійською.
6. **Спершу детермінований аналіз, LLM — лише на вимогу** і ніколи на шляху прийому знімків.
   [ADR-0007](docs/decisions/0007-deterministic-first-ai-on-demand.md).
7. **Секрети не виходять із сервера:** токени Jira лише записуються, API відповідає
   `jiraTokenSet`. Рядок користувача ніколи не віддається цілком.

## Як ми працюємо: спершу специфікація

Нова фіча або зміна поведінки проходить цикл **Specify → Plan → Tasks → Implement → Verify →
Document**. Специфікація в `docs/specs/NNN-назва/spec.md` фіксує, *що* і *навіщо*, з
пронумерованими вимогами. Реалізацію починаємо, коли специфікація у статусі `Approved`. Кожна
вимога посилається на тест, який її перевіряє. Повністю цикл описано в
[docs/guides/agentic-workflow.md](docs/guides/agentic-workflow.md).

Дрібні виправлення (опечатка, очевидний баг без зміни поведінки) специфікації не потребують,
але тест — так.

## Структура

| Шлях | Що там | Інструкції |
|---|---|---|
| `backend/` | NestJS 11 + Prisma 6 + Postgres: API, порівняння, UI-дерево, доступність, Jira, AI | [backend/AGENTS.md](backend/AGENTS.md) |
| `frontend/` | React 18 + MUI 5 + Vite, Playwright | [frontend/AGENTS.md](frontend/AGENTS.md) |
| `sdk-java/` | Java SDK (upstream + `uiTree`) | [sdk-java/AGENTS.md](sdk-java/AGENTS.md) |
| `scripts/` | `vision.sh`, копія даних із проду, збірка jar, тести CLI | [scripts/AGENTS.md](scripts/AGENTS.md) |
| `frontend/public/cli/vision.py` | CLI і MCP-сервер для ручних перевірок | [spec 009](docs/specs/009-manual-checks-cli-mcp/spec.md) |
| `dist/sdk-java/` | зібраний jar для автотестів | [DEPLOY.md §7](DEPLOY.md) |
| `docs/` | специфікації, рішення, архітектура, гайди | [docs/README.md](docs/README.md) |
| `DEPLOY.md`, `DEMO.md` | розгортання поруч із продом (рос.), демо | — |

## Команди

| Що | Команда |
|---|---|
| Unit-тести бекенду | `cd backend && npm test` (лише `src/`; `npx jest` без `--projects` запускає e2e, яким потрібна база) |
| Типи й лінт бекенду | `cd backend && npx tsc --noEmit -p tsconfig.json && npx eslint src` |
| Unit-тести фронтенду | `cd frontend && CI=true npx jest` |
| Типи фронтенду | `cd frontend && npx tsc --noEmit -p .` (базова лінія — 25 відомих помилок апстріму; нових бути не повинно) |
| Playwright | `cd frontend && npx playwright test` (скриншот-тести локально на macOS завжди падають; еталони — лише в Docker, див. [testing](docs/guides/testing.md)) |
| SDK | `cd sdk-java && gradle test` (JDK 11–17, Gradle 7.x); jar — `./scripts/build-sdk-jar.sh` |
| CLI | `python3 -I scripts/tests/test_vision_cli.py` (фейковий API і adb, пристрій не потрібен) |
| Розгортання | лише `./scripts/vision.sh …` ([DEPLOY.md](DEPLOY.md)) |

## Перш ніж сказати «готово»

- Тести, що покривають зміну, зелені; нові вимоги мають тести.
- Типи й лінт без нових помилок; `prettier` — лише по змінених файлах, не по всьому `src`.
- Якщо змінився UI на скриншот-тестах — еталони перегенеровано в Docker.
- Специфікація, ADR і DEPLOY.md/DEMO.md відповідають тому, що зроблено (див.
  [documentation](docs/guides/documentation.md)).
- Коміт закінчується рядком `Co-Authored-By`, який задає середовище.

## Куди далі

- Що це і для кого: [docs/product/overview.md](docs/product/overview.md), терміни: [glossary](docs/product/glossary.md)
- Як влаштовано: [docs/architecture/overview.md](docs/architecture/overview.md)
- Конкретна фіча: [docs/specs/](docs/specs/README.md)
- Чому зроблено саме так: [docs/decisions/](docs/decisions/README.md)
- Локальне середовище і тести: [docs/guides/development.md](docs/guides/development.md), [testing](docs/guides/testing.md)
