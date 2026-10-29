# Vision — інструкції для агентів

Vision — внутрішній форк [Visual Regression Tracker](https://github.com/Visual-Regression-Tracker/Visual-Regression-Tracker)
для QA мобільних застосунків (Android «AOS» та iOS, Appium + Selenide). До піксельного порівняння
він додає аналіз UI-дерева, перевірки доступності, баги в Jira, групи змін, Insights і CLI/MCP.

Це рівень 0: правила, що діють завжди, і куди йти далі. Деталі — за посиланнями, коли вони
потрібні задачі.

## Непорушні правила

Порушення правил 1–4 не виправити, тому `.claude/hooks/guard.py` блокує їх для агентів.

1. **Робочий VRT і його база не повинні постраждати за жодних умов.** Vision стоїть на тій самій
   машині й працює на копії даних. docker compose — лише через `./scripts/vision.sh`; нові
   скрипти — за запобіжниками `scripts/lib/vision-safety.sh` ([ADR-0002](docs/decisions/0002-production-is-read-only.md)).
2. **Пуш лише в remote `vision`:** `git -c http.postBuffer=1048576000 push vision mvp/demo:main`.
   `origin` — upstream VRT ([ADR-0001](docs/decisions/0001-fork-as-subtree-monorepo.md)).
3. **Міграції лише додавальні:** нова таблиця, nullable-колонка, індекс; без змін enum, видалень,
   перейменувань ([ADR-0003](docs/decisions/0003-additive-schema-only.md)).
4. **Жодних скидань і видалень бази** (`prisma migrate reset`, `DROP DATABASE`, `dropdb`).
5. **SDK = upstream + два необов'язкові параметри** `TestRunOptions.uiTree` і `featureName` ([ADR-0019](docs/decisions/0019-sdk-upstream-plus-ui-tree-and-feature.md)).
6. **LLM — лише на вимогу,** ніколи при прийомі знімків ([ADR-0007](docs/decisions/0007-deterministic-first-ai-on-demand.md)).
7. **Секрети не виходять із сервера:** токени Jira лише записуються (`jiraTokenSet`); рядок
   `User` ніколи не віддається цілком.
8. **Дії назовні — лише з явного дозволу людини:** пуш, зміни в реальній Jira, повідомлення,
   видалення даних.

## Як ми працюємо: специфікація → дизайн → задачі

Нова фіча чи зміна поведінки: `/spec` → затвердження людиною → `/design` (дизайн і задачі) →
реалізація з тестами → `/verify`. Специфікація — у `docs/specs/NNN-…/spec.md`, кожна вимога має
тест у `design.md`. Цикл повністю — у [agentic-workflow](docs/guides/agentic-workflow.md).
Виправлення бага без зміни поведінки специфікації не потребує, але тест — так.

## Структура і команди

| Шлях | Що там | Команди й правила |
|---|---|---|
| `backend/` | NestJS 11 + Prisma 6 + Postgres: API, UI-дерево, доступність, Jira, AI | [backend/AGENTS.md](backend/AGENTS.md) |
| `frontend/` | React 18 + MUI 5 + Vite, Playwright; CLI `public/cli/vision.py` | [frontend/AGENTS.md](frontend/AGENTS.md) |
| `sdk-java/` | Java SDK (upstream + `uiTree`, `featureName`) | [sdk-java/AGENTS.md](sdk-java/AGENTS.md) |
| `scripts/` | `vision.sh`, копія даних проду, jar SDK, перевірка документації | [scripts/AGENTS.md](scripts/AGENTS.md) |
| `docs/` | специфікації, рішення, архітектура, гайди | [docs/README.md](docs/README.md) |
| `DEPLOY.md`, `DEMO.md` | розгортання поруч із продом (рос.), демо (англ.) | — |

Повна перевірка перед «готово» — `/verify`. Перелік команд для кожного пакета — у ньому й у
[testing](docs/guides/testing.md).

## Стиль коду

- TypeScript скрізь, крім SDK (Java) і CLI (Python, лише стандартна бібліотека).
- Логіку пишемо чистими функціями, а сервіси Nest лише завантажують дані й викликають їх.
- Коментарі пояснюють *чому*, а не *що*. Назва тесту — поведінка: «links instead of filing when
  someone filed the problem already».
- `prettier` і `eslint` — лише по змінених файлах; чужий код не переформатовуємо.
- Інтерфейс двома мовами: кожен текст — ключ словника з англійським і українським перекладом
  ([ADR-0017](docs/decisions/0017-interface-in-two-languages.md)). Документація для команди
  українською, ідентифікатори англійською.

## Коміти

- Тема — що змінилось з погляду користувача, до ~70 символів, англійською; тіло — чому і що
  важливо знати.
- Зміна поведінки, її специфікація й тести — в одному коміті.
- Останній рядок — `Co-Authored-By: …`, якщо його вимагає середовище агента.

## Куди далі

- Що це й для кого: [огляд](docs/product/overview.md), [словник](docs/product/glossary.md)
- Як влаштовано: [архітектура](docs/architecture/overview.md), [дані](docs/architecture/data-model.md), [API](docs/architecture/api.md)
- Фіча: [docs/specs/](docs/specs/README.md); чому так: [docs/decisions/](docs/decisions/README.md)
- Локальний запуск і тести: [development](docs/guides/development.md), [testing](docs/guides/testing.md)
