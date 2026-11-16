# Vision — frontend

Інтерфейс Vision: React 18, MUI 5, Vite. Правила, команди й пастки — у [AGENTS.md](AGENTS.md).

## Локально

Потрібні Node 24.9+ і API Vision (`backend/`).

```bash
npm ci
npm start               # env.sh пише public/env-config.js з env.defaults (або з .env, якщо він є)
```

Адреса API — `REACT_APP_API_URL` у середовищі або в `.env` поруч (зразок — `env.defaults`).
Тести — `CI=true npx jest` і `npx playwright test --ignore-snapshots`
([docs/guides/testing.md](../docs/guides/testing.md)).
