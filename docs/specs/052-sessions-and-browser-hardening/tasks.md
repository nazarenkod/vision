# 052 — Задачі

- [ ] **T0** Тести на поточну поведінку, до змін: вхід паролем і SSO, токен на маршрутах, API-ключ,
  сокет подій (рукостискання, кімнати, закриття на `exp`), ролі SSO при вході, заголовки API й
  nginx; весь Playwright як еталон інтерфейсу.
  - Готово, коли: тести зелені на коді до змін.
- [ ] **T1** (REQ-052-01…06, 14) Сесії в базі, вихід, відкликання, сокет.
  - Файли: міграція, `auth/sessions.ts`, `auth.service.ts`, `jwt.strategy.ts`, `users.*`,
    `events.gateway.ts`, фронтенд `users.service.ts`.
  - Готово, коли: `sessions.e2e-spec.ts` і тести T0 зелені.
- [ ] **T2** [P] (REQ-052-07) SSO лише у своєму браузері: `nonce`.
  - Готово, коли: тести бекенду й `login.spec.ts` зелені.
- [ ] **T3** [P] (REQ-052-08…11) CSP і HSTS в API й nginx, та сама політика в Playwright.
  - Готово, коли: увесь Playwright проходить під CSP без порушень, тести заголовків зелені.
- [ ] **T4** [P] (REQ-052-12) Ролі SSO.
  - Готово, коли: тест `oidcusers.service.spec.ts` зелений, наявні тести ролей не змінились.
- [ ] **T5** Документація: «Замінено» в [032](../032-authenticated-events/spec.md) REQ-032-04 і
  [045](../045-sign-in-and-api-hardening/spec.md) REQ-045-08, `backend/AGENTS.md`, `frontend/AGENTS.md`,
  DEPLOY.md (HSTS за проксі, CSP), `audit/PROGRESS.md`, статус `Implemented`.
- [ ] **T6** `/verify` з Playwright, e2e бекенду, стенд (відтворення 009/018/011/020 до й після),
  незалежне рев'ю.
