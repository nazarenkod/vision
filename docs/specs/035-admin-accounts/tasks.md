# 035 — Задачі

- [x] **T1** (REQ-035-03, 10…16) Бекенд: акаунт від адміністратора.
  - Файли: `backend/src/users/users.controller.ts`, `users.service.ts`, `account.ts`,
    `dto/account-create.dto.ts`, `db/dbusers.service.ts`; тести `users.controller.spec.ts`,
    `users.service.spec.ts`; `backend/test/users.e2e-spec.ts`,
    `backend/test_acceptance/acceptance.spec.ts` — без `/users/register`.
  - Готово, коли: `register` немає; `POST /users` лише для адміна, дубль пошти в будь-якому
    регістрі — 400, в LDAP/SSO — 400; `GET /users/accounts/enabled`; тести з «Перевірки вимог»
    зелені.
- [x] **T2** [P] (REQ-035-30…32, 34, 35) Бекенд: лише особисті токени Jira.
  - Файли: `backend/src/a11y/jira-access.ts` (+ `jira-access.spec.ts`),
    `backend/src/projects/projects.service.ts`, `dto/project.dto.ts`, `dto/create-project.dto.ts`,
    `settings-conflict.ts`, `shared-jira-credentials.ts` (+ spec); фікстури проєктів у
    специфікаціях, що чекають `jiraTokenSet`.
  - Готово, коли: `jiraAccess` без особистого токена — 400 навіть зі спільним; API проєкту не
    приймає й не віддає спільні токен і пошту; чищення при старті ідемпотентне; тести зелені.
- [x] **T3** (REQ-035-33) Тест: секрети Jira й Gemini пишуться лише в рядок того, хто увійшов.
  - Файли: `backend/src/users/users.controller.spec.ts`.
  - Готово, коли: тест `writes Jira and Gemini secrets only to the signed-in person` зелений.
- [x] **T4** (REQ-035-01, 02) Фронтенд: без реєстрації.
  - Файли: `frontend/src/components/LoginForm.tsx`, `Router.jsx`, `constants/routes.ts`,
    `constants/help.ts`, `services/users.service.ts`; видалити `pages/RegisterPage.tsx`,
    `components/RegisterForm.tsx`, `integration_tests/test/register.spec.ts` з еталоном,
    фікстуру й сторінку `RegisterPage`; ключі `auth.*` реєстрації й `tour.loginRegister`.
  - Готово, коли: `login.spec.ts` з новими тестами зелений.
- [x] **T5** (REQ-035-10…12, 16, 20, 21) Фронтенд: Users.
  - Файли: `frontend/src/pages/UserListPage.tsx`, `components/UserList/index.tsx`,
    `components/UserList/NewUserDialog.tsx`, `_helpers/users.helper.ts` (+ test),
    `services/users.service.ts`, `types/user.ts`, `i18n/en.ts`, `uk.ts`.
  - Готово, коли: `userList.spec.ts` і `users.helper.test.ts` зелені.
- [x] **T6** [P] (REQ-035-30, 32, 34) Фронтенд: Jira в проєкті без спільного токена.
  - Файли: `frontend/src/components/ProjectForm/ProjectForm.tsx`, `TestDetailsDialog/InsightsPanel.tsx`,
    `TestDetailsDialog/TestDetailsModal.tsx`, `pages/ProjectListPage.tsx`, `types/project.ts`,
    `i18n/en.ts`, `uk.ts` (`jira.*`, `section.jiraIntro`, `profile.tokenNotSet`);
    `integration_tests/test/projectSettings.spec.ts`, `reportBug.spec.ts`, `projectList.spec.ts`.
  - Готово, коли: функціональні тести зелені; T5 і T6 обидва правлять `i18n` — робити по черзі.
- [x] **T7** Еталони скриншотів у Docker (з копії frontend у scratchpad): `login-page`,
  `user-list-page`, `project-settings-page-uk`, `projects-list-page` — лише ті, що змінились;
  переглянути кожен перед заміною.
- [x] **T8** Документація: статус spec → `Implemented`; ADR-0025 → `Accepted`, ADR-0010 →
  `Superseded by ADR-0025`; позначки «Замінено» в 005 REQ-005-01/02, 025 REQ-025-05, 018
  REQ-018-50; граничний випадок 013 про спільний токен; `docs/architecture/api.md`,
  `data-model.md`, `backend/AGENTS.md` (правило Jira), `docs/specs/005-jira-bugs/design.md`;
  DEPLOY.md — попросити команду додати свої токени перед оновленням.
- [ ] **T9** `/verify`: тести, типи, лінт, еталони скриншотів, `scripts/check-docs.py`, сценарії
  приймання.
