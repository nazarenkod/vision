# Vision

Візуальні перевірки мобільних застосунків (Android і iOS, Appium + Selenide): знімки екранів з
автотестів порівнюються з еталонами з урахуванням UI-дерева екрана, перевіряється доступність,
баги заводяться в Jira, зміни рев'ю групами, Insights показують стан проєктів.

- Що це й для кого: [огляд продукту](docs/product/overview.md), [словник](docs/product/glossary.md)
- Розгортання й оновлення: [DEPLOY.md](DEPLOY.md); показ: [DEMO.md](DEMO.md)
- Документація для розробки: [docs/](docs/README.md); правила для агентів: [AGENTS.md](AGENTS.md)

## Складові

| Папка | Що там |
|---|---|
| `backend/` | API: NestJS 12, Prisma 7, PostgreSQL |
| `frontend/` | інтерфейс: React 18, MUI 5, Vite; CLI і MCP `public/cli/vision.py` |
| `sdk-java/` | Java SDK `ua.vision:vision-sdk` для автотестів |
| `scripts/` | запуск (`vision.sh`), копія даних, перевірки (`verify.py`, `control-scenario.sh`) |

## Швидкий старт

Потрібні Docker з Compose v2, а для розробки — Node 24.9+ (`.nvmrc`).

```bash
cp .env.demo.example .env.demo
./scripts/vision.sh up -d --build
```

Подробиці — у [DEPLOY.md](DEPLOY.md).

## Ліцензія

Apache-2.0 ([LICENSE](LICENSE)). Vision — похідна робота від Visual Regression Tracker; атрибуція
— у [NOTICE](NOTICE).
