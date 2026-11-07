# Маршрути backend Vision (коміт 7b13af1) — карта авторизації

Агент B. Глобально: `ValidationPipe()` без `whitelist`/`forbidNonWhitelisted` (`backend/src/main.ts:42`);
глобальний `ProjectAccessInterceptor` (`backend/src/projects/project-access.module.ts:13`) перевіряє лише
джерела, оголошені в `@ProjectFrom(...)`; значення, що не знайшло рядка, пропускається («лишається маршруту»).
Ролі: `RoleGuard` + `@Roles`; без `@Roles` — будь-яка роль (включно з guest).

Позначки: J = `JwtAuthGuard`, A = `ApiGuard` (заголовок `apiKey`), M = `MixedGuard` (JWT або apiKey), R = `RoleGuard`.
«Проєкт» — звідки інтерцептор бере проєкт; NPD = `@NoProjectData()`.

## HTTP

| Метод | Шлях | Контролер:рядок | Guard | Ролі | Перевірка проєкту | Примітка |
|---|---|---|---|---|---|---|
| GET | /test-runs?buildId | test-runs.controller.ts:74 | J | усі | query buildId → build | |
| GET | /test-runs/groups?buildId | test-runs.controller.ts:83 | J | усі | query buildId → build | групи змін |
| GET | /test-runs/:id | test-runs.controller.ts:92 | J | усі | param id → testRun | |
| GET | /test-runs/:id/a11y | test-runs.controller.ts:101 | M | усі | param id → testRun | звіт доступності, CLI |
| POST | /test-runs/:id/a11y/ignore | test-runs.controller.ts:110 | J,R | admin, editor | param id → testRun | |
| POST | /test-runs/:id/a11y/reset | test-runs.controller.ts:124 | J,R | admin, editor | param id → testRun | |
| POST | /test-runs/:id/a11y/link | test-runs.controller.ts:138 | J,R | admin, editor | param id → testRun | |
| POST | /test-runs/:id/a11y/jira/prepare | test-runs.controller.ts:152 | J,R | admin, editor | param id → testRun | Jira особистим токеном |
| GET | /test-runs/:id/a11y/jira/users | test-runs.controller.ts:175 | J,R | admin, editor | param id → testRun | |
| POST | /test-runs/:id/a11y/jira | test-runs.controller.ts:185 | J,R | admin, editor | param id → testRun | |
| POST | /test-runs/:id/element-rules | test-runs.controller.ts:205 | J,R | admin, editor | param id → testRun | scope project змінює налаштування проєкту |
| POST | /test-runs/:id/element-rules/remove | test-runs.controller.ts:215 | J,R | admin, editor | param id → testRun | |
| POST | /test-runs/:id/ignore-areas/replace-with-element | test-runs.controller.ts:225 | J,R | admin, editor | param id → testRun | |
| GET | /test-runs/:id/selector-matches | test-runs.controller.ts:235 | M | усі | param id → testRun | |
| GET | /test-runs/:id/structure | test-runs.controller.ts:245 | M | усі | param id → testRun | UI-дерево, CLI |
| POST | /test-runs/approve?merge | test-runs.controller.ts:254 | J,R | admin, editor | body (масив) → testRuns | журнал рішень |
| POST | /test-runs/reject | test-runs.controller.ts:271 | J,R | admin, editor | body (масив) → testRuns | |
| POST | /test-runs/undo/:decisionId | test-runs.controller.ts:282 | J,R | admin, editor | param → decision (testRunId з items) | + лише автор рішення (decision-undo.service.ts:43) |
| POST | /test-runs/delete | test-runs.controller.ts:297 | J,R | admin, editor | body (масив) → testRuns | |
| POST | /test-runs/ignoreAreas/update | test-runs.controller.ts:310 | J,R | admin, editor | body.ids → testRuns | |
| POST | /test-runs/ignoreAreas/add | test-runs.controller.ts:323 | J,R | admin, editor | body.ids → testRuns | |
| PATCH | /test-runs/update/:testRunId | test-runs.controller.ts:336 | J,R | admin, editor | param → testRun | **тіло без whitelist іде у варіацію (B-02)** |
| POST | /test-runs | test-runs.controller.ts:348 | A,R | admin, editor | body.buildId → build, body.projectId → project (403) | SDK/CLI |
| POST | /test-runs/multipart | test-runs.controller.ts:366 | A,R | admin, editor | те саме; інтерцептор повторно після FileToBody (рядок 374) | SDK |
| POST | /test-runs/:id/bug/prepare | visual-bugs.controller.ts:18 | J,R | admin, editor | param id → testRun | |
| POST | /test-runs/:id/bug | visual-bugs.controller.ts:28 | J,R | admin, editor | param id → testRun | |
| GET | /test-runs/:id/bugs | visual-bugs.controller.ts:38 | J | усі | param id → testRun | фільтр за run.projectId (visual-bugs.service.ts:261) |
| GET | /builds?projectId&take&skip | builds.controller.ts:44 | J | усі | query projectId → project | |
| GET | /builds/:id | builds.controller.ts:65 | J | усі | param id → build | |
| GET | /builds/:id/overview | builds.controller.ts:75 | J | усі | param id → build | |
| DELETE | /builds/:id | builds.controller.ts:83 | J,R | admin, editor | param id → build | |
| POST | /builds | builds.controller.ts:93 | A,R | admin, editor | body.project (id або назва) → project (403) | SDK/CLI |
| PATCH | /builds/:id | builds.controller.ts:110 | M,R | admin, editor | param id → build (403) | **ModifyBuildDto — інтерфейс, тіло цілком у `prisma.build.update` (B-01, Critical)**; CLI кличе з apiKey |
| PATCH | /builds/:id/approve?merge | builds.controller.ts:126 | J,R | admin, editor | param id → build | |
| POST | /builds/:id/report-links | reports.controller.ts:23 | J,R | admin, editor | param id → build | |
| GET | /builds/:id/report | reports.controller.ts:36 | J | усі | param id → build | |
| GET | /builds/:id/report-links | reports.controller.ts:44 | J | усі (guest теж) | param id → build | віддає токени публічних посилань (B-05) |
| DELETE | /report-links/:id | reports.controller.ts:52 | J | усі; сервіс: автор або admin | param id → reportLink | reports.service.ts:70 |
| GET | /public/reports/:token | reports.controller.ts:64 | — (публічний) | — | NPD; доступ за токеном 256 біт | ADR-0022 |
| GET | /test-variations?projectId | test-variations.controller.ts:24 | J | усі | query → project | |
| GET | /test-variations/details/:id | test-variations.controller.ts:36 | J | усі | param → variation | user лише select id/імена/email |
| GET | /test-variations/merge/ | test-variations.controller.ts:46 | J,R | admin, editor | query projectId → project | MergeParams @IsUUID |
| DELETE | /test-variations/:id | test-variations.controller.ts:60 | J,R | admin, editor | param → variation | |
| GET | /projects | projects.controller.ts:100 | J | усі | NPD; фільтр grantedTo у контролері (рядок 107) | |
| GET | /projects/:id/devices | projects.controller.ts:112 | J | усі | param → project | |
| POST | /projects | projects.controller.ts:121 | J,R | admin, editor | NPD; автору-editor grant | |
| PUT | /projects | projects.controller.ts:134 | J,R | admin, editor | body.id → project | editor змінює Jira URL, ключ Gemini, назву (B-06) |
| DELETE | /projects/:id | projects.controller.ts:151 | J,R | admin, editor | param → project | editor видаляє весь проєкт (B-06) |
| GET | /projects/:id/access | projects.controller.ts:163 | J,R | admin | param → project | |
| PUT | /projects/:id/access/:userId | projects.controller.ts:172 | J,R | admin | param → project | |
| DELETE | /projects/:id/access/:userId | projects.controller.ts:187 | J,R | admin | param → project | + leaveProject для сокета |
| GET | /analytics/:projectId?days | analytics.controller.ts:58 | J | усі | param → project | усі запити сервісу з where projectId |
| GET | /ai/status | ai.controller.ts:87 | J | усі | NPD | |
| POST | /ai/group-summary | ai.controller.ts:96 | J | усі (guest теж) | body.buildId → build | LLM ключем проєкту (B-07) |
| POST | /ai/a11y-labels | ai.controller.ts:105 | J | усі (guest теж) | body.testRunId → testRun | LLM (B-07) |
| POST | /ai/bug-draft | ai.controller.ts:114 | J | усі (guest теж) | body.testRunId → testRun | особистий ключ |
| POST | /users | users.controller.ts:66 | J,R | admin | NPD | |
| GET | /users/accounts/enabled | users.controller.ts:76 | — (публічний) | — | NPD | |
| POST | /users/login | users.controller.ts:83 | — (публічний) | — | NPD | ліміт 5/15 хв |
| GET | /users/oidc/enabled | users.controller.ts:90 | — (публічний) | — | NPD | |
| GET | /users/oidc/login | users.controller.ts:97 | — (публічний) | — | NPD | |
| GET | /users/oidc/callback | users.controller.ts:126 | — (публічний) | — | NPD | |
| GET | /users/me | users.controller.ts:162 | J | усі | NPD | UserDto |
| GET | /users/newApiKey | users.controller.ts:171 | J | усі | NPD | GET змінює стан |
| PUT | /users/password | users.controller.ts:180 | J | усі | NPD | |
| PUT | /users/:id/password | users.controller.ts:189 | J,R | admin | NPD | |
| PUT | /users | users.controller.ts:199 | J | усі | NPD | лише email/імена (dbusers.service.ts:35) |
| PUT | /users/jira | users.controller.ts:208 | J | усі | NPD | токен sealSecret, у відповіді jiraTokenSet |
| PUT | /users/gemini | users.controller.ts:224 | J | усі | NPD | |
| GET | /users/all | users.controller.ts:238 | J,R | admin | NPD | UserDto + projects |
| DELETE | /users | users.controller.ts:260 | J,R | admin | NPD | |
| PATCH | /users/assignRole | users.controller.ts:273 | J,R | admin | NPD | |
| GET | /images/:fileName?sig | static.controller.ts:34 | — (підпис HMAC) | — | NPD | підпис не прив'язаний до людини (043) |
| GET | /images/:fileName/download?sig | static.controller.ts:58 | — (підпис HMAC) | — | NPD | |
| GET | /backups/status | backups.controller.ts:104 | J,R (клас) | admin | NPD | |
| GET | /backups | backups.controller.ts:111 | J,R (клас) | admin | NPD | |
| POST | /backups/drive/connect | backups.controller.ts:118 | J,R (клас) | admin | NPD | |
| POST | /backups/drive/poll | backups.controller.ts:125 | J,R (клас) | admin | NPD | |
| POST | /backups/drive/test | backups.controller.ts:132 | J,R (клас) | admin | NPD | |
| DELETE | /backups/drive | backups.controller.ts:139 | J,R (клас) | admin | NPD | |
| PUT | /backups/settings | backups.controller.ts:146 | J,R (клас) | admin | NPD | |
| POST | /backups/run | backups.controller.ts:153 | J,R (клас) | admin | NPD | |
| GET | /ollama/models | ollama.controller.ts:31 | J,R (клас) | admin, editor | NPD | |
| POST | /ollama/compare | ollama.controller.ts:37 | J,R (клас) | admin, editor | NPD | власні файли |
| GET | /health | health.controller.ts:18 | — (публічний) | — | NPD | |
| (Swagger) | /api … | swagger.ts | — | — | — | лише з `VISION_SWAGGER` |

Разом: 87 HTTP-маршрутів (13 контролерів), публічних без входу — 8 (`/users/login`, `/users/accounts/enabled`,
`/users/oidc/{enabled,login,callback}`, `/health`, `/public/reports/:token`) + 2 за підписом (`/images/...`).

## socket.io (`backend/src/shared/events/events.gateway.ts`)

| Що | Рядок | Хто | Перевірка |
|---|---|---|---|
| рукостискання (middleware) | 48–81 | JWT у `handshake.auth.token`; apiKey не читається | `verifyToken` + користувач існує за email; розрив на `exp` |
| `subscribe {projectId}` | 83–112 | будь-яка роль | проєкт існує + admin або рядок `ProjectAccess`; кімната `project:<id>` |
| `leaveProject` (сервер) | 115–125 | викликається з revoke | лише при відкликанні доступу; не при видаленні користувача / зміні ролі (B-08) |
| emit `build_created`, `build_updated`, `build_deleted` | 127–161, 225–250 | кімната проєкту | BuildDto (userId, без рядка User) |
| emit `testRun_created/updated/deleted` | 139–223 | кімната проєкту (старі run — за проєктом збірки) | рядок TestRun цілком, з підписами файлів |

## Cron

| Задача | Файл:рядок | Що робить |
|---|---|---|
| `cleanOldTestVariations` | backend/src/shared/tasks/tasks.service.ts:16 | щоночі по всіх проєктах видаляє варіації гілок старші за `maxBranchLifetime` (поза HTTP, без користувача) |
