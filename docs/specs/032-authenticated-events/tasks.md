# 032 — Задачі

- [ ] **T1** (REQ-032-01…04) Вхід на рукостисканні: `AuthService.verifyToken`, `events-auth.ts`,
  middleware і таймер терміну в `EventsGateway`, `AuthModule` у `SharedModule`.
  - Файли: `backend/src/auth/auth.service.ts`, `backend/src/shared/events/*`, `backend/src/shared/shared.module.ts`
  - Готово, коли: тести відмов і прийняття в `events.gateway.spec.ts` і `events-auth.spec.ts` зелені.
- [ ] **T2** (REQ-032-09…11) Кімнати: `events-rooms.ts`, `subscribe`, розсилка по кімнатах.
  - Файли: `backend/src/shared/events/*`
  - Готово, коли: тести кімнат у `events.gateway.spec.ts` і `events-rooms.spec.ts` зелені.
- [ ] **T3** [P] (REQ-032-08, 12) `socket.events.ts` і `logoutAndReload()`.
  - Файли: `frontend/src/contexts/socket.events.ts`, `frontend/src/_helpers/service.helpers.ts`
  - Готово, коли: `socket.events.test.ts` зелений.
- [ ] **T4** (REQ-032-05…07, 10) `SocketProvider`: з'єднання лише з входом, токен у `auth`,
  підписка на обраний проєкт.
  - Файли: `frontend/src/contexts/socket.context.tsx`, `frontend/integration_tests/test/liveEvents.spec.ts`
  - Готово, коли: `liveEvents.spec.ts` і `testDetailsDialog.spec.ts` зелені з `--ignore-snapshots`.
- [ ] **T5** Документація: `docs/architecture/api.md` (сокет), `docs/architecture/overview.md`,
  `backend/AGENTS.md`; статус spec → `Implemented`.
- [ ] **T6** `/verify`: тести, типи, лінт, Playwright без еталонів, `scripts/check-docs.py`.
