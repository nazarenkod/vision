# Vision — backend

API Vision: NestJS 12, Prisma 7, PostgreSQL. Правила, команди й пастки — у [AGENTS.md](AGENTS.md);
тести — [docs/guides/testing.md](../docs/guides/testing.md).

## Локально

Потрібні Node 24.9+ і PostgreSQL.

```bash
cp .env.example .env        # адреса бази, JWT_SECRET, адмін за замовчуванням
npm ci
npx prisma migrate deploy && npx ts-node prisma/seed.ts
npm run start:dev
```

Документація API — `http://localhost:4200/api`.

## Вхід через LDAP або OIDC

Для перевірки є моки в `docker-compose.ldap.yml` і `docker-compose.oidc.yml` поверх
`docker-compose.yml` (образи закріплені за digest). Налаштування — змінні `LDAP_*` і `OIDC_*` у
[.env.example](.env.example); тести — `npm run test:ldap`, `npm run test:oidc`. Ці compose-файли —
лише для розробки; Vision розгортається через `scripts/vision.sh` ([DEPLOY.md](../DEPLOY.md)).
