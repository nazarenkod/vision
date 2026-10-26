# Локальна розробка

Образи Docker збираємо лише на сервері: локально диск тісний, і збирання вже раз заповнило його.
Локально запускаємо Postgres у контейнері, а API та UI — нативно.

## Що потрібно

- Node 20+ (бекенд і фронтенд), Python 3 (CLI), JDK 11–17 і Gradle 7.x (SDK).
- Docker — лише для Postgres і Playwright-еталонів. Якщо `docker` не бачить демона, вкажи сокет
  Docker Desktop: `DOCKER_HOST=unix://$HOME/.docker/run/docker.sock`.

## Запуск

```bash
# 1. Postgres
docker run -d --name vision-dev-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=vrt_dev -p 15433:5432 postgres:16

# 2. API (порт 14201)
cd backend
npm install
DATABASE_URL=postgresql://postgres:postgres@localhost:15433/vrt_dev npx prisma migrate deploy
npm run build
DATABASE_URL=postgresql://postgres:postgres@localhost:15433/vrt_dev JWT_SECRET=dev-secret \
  JWT_LIFE_TIME=7d APP_FRONTEND_URL=http://localhost:5173 APP_PORT=14201 \
  BODY_PARSER_JSON_LIMIT=20mb TASKS_CLEANUP_ENABLED=false AI_PROVIDER=none \
  node dist/src/main.js

# 3. UI (порт 5173)
cd frontend
npm install
REACT_APP_API_URL=http://localhost:14201 sh ./env.sh && cp env-config.js public/ && npx vite --port 5173
```

Першого користувача створює seed upstream (див. `backend/prisma/seed.ts`) або реєстрація в UI.

## Дані для перевірки

- `scripts/upload-uitree-samples.py` надсилає пари PNG + XML з папки як перевірки.
- `python3 frontend/public/cli/vision.py check "Payment" --png screen.png --xml screen.xml` — одна перевірка з файлів.
- Jira без реальної Jira: простий фейковий сервер на Python, що відповідає на
  `/rest/api/2/issue`, `/issue/createmeta/<project>/issuetypes`, `/search/jql`, `/user/picker`,
  `/issueLink`. URL фейка вказуєш у налаштуваннях проєкту.

## Де шукати

- Swagger: `http://localhost:14201/api`.
- Логи API — у терміналі; перенесення старих рішень пише в лог `Moved N accessibility decisions`.

## Перед комітом

Чекліст — у [testing.md](testing.md#перед-комітом). Пуш — лише в `vision` (див.
[AGENTS.md](../../AGENTS.md)).
