# 082 — Задачі

- [x] **T1** (REQ-082-01…05) Перший адміністратор без запасного пароля, без пароля й рядків проєктів у виводі.
  - Файли: `backend/prisma/seed.ts`, `prisma/test/seed.spec.ts`, `docker-compose.demo.yml`,
    `.env.demo.example`, `backend/.env.example`, `backend/test_acceptance/acceptance.spec.ts`,
    `README.md`, `DEPLOY.md`, `docs/admin/configuration.md`, `docs/security/overview.md`.
  - Готово, коли: нові тести seed падають на старому коді й проходять на новому.
- [x] **T2** [P] (REQ-082-06, 07) SHA-1 → SHA-256.
  - Файли: `change-groups.service.ts`, `screen-checks.ts`, `a11y-problems.ts`, `reports.controller.ts`.
  - Готово, коли: усі unit-тести бекенду зелені без зміни очікувань.
- [x] **T3** [P] (REQ-082-08, 09) Порожні обробники помилок.
  - Файли: `backend/src/auth/guards/mixed.guard.ts` і новий `mixed.guard.spec.ts` (на старому коді
    теж зелений: поведінка та сама), `frontend/public/cli/vision.py`, `scripts/tests/test_vision_cli.py`.
- [x] **T5** (REQ-082-10, 11) Без вимкнення перевірки TLS для OIDC і LDAP.
  - Файли: `oidcusers.service.ts`, `ldapusers.service.ts` і їхні тести, `src/users/removed-tls-option.ts`,
    `docker-compose.demo.yml`, `backend/docker-compose.ldap.yml`, `backend/.env.example`,
    `.env.demo.example`, `DEPLOY.md`, `docs/admin/configuration.md`, `docs/security/overview.md`.
  - Ручна перевірка власником: вхід через корпоративний LDAP/SSO на стенді.
- [x] **T4** Запобіжник `scripts/tests/test_scanner_findings.py`, звіт аудиту, `/verify`.
