# Ендпоінти Vision на fe7a82c: guard → роль → перевірка проєкту (042)

Згенеровано з декораторів (routes.py) і перевірено вручну. Глобально: ProjectAccessInterceptor (APP_INTERCEPTOR, після guards), пайпи ListLengthPipe → ValidationPipe → StripUnknownFieldsPipe.
Тест project-access.routes.spec.ts вимагає позначки на кожному маршруті 13 контролерів (їх справді 13).

| Ендпоінт | Guards | Ролі | Проєкт | Файл |
|---|---|---|---|---|
| GET /ai/status | JwtAuthGuard | any signed-in | NoProjectData() | ai/ai.controller.ts |
| POST /ai/group-summary | JwtAuthGuard | any signed-in | ProjectFrom(inBody('buildId', 'build')) | ai/ai.controller.ts |
| POST /ai/a11y-labels | JwtAuthGuard | any signed-in | ProjectFrom(inBody('testRunId', 'testRun')) | ai/ai.controller.ts |
| POST /ai/bug-draft | JwtAuthGuard | any signed-in | ProjectFrom(inBody('testRunId', 'testRun')) | ai/ai.controller.ts |
| GET /analytics/:projectId | JwtAuthGuard | any signed-in | ProjectFrom(inParam('projectId', 'project')) | analytics/analytics.controller.ts |
| GET /backups/status | JwtAuthGuard, RoleGuard | admin | NoProjectData() | backups/backups.controller.ts |
| GET /backups | JwtAuthGuard, RoleGuard | admin | NoProjectData() | backups/backups.controller.ts |
| POST /backups/drive/connect | JwtAuthGuard, RoleGuard | admin | NoProjectData() | backups/backups.controller.ts |
| POST /backups/drive/poll | JwtAuthGuard, RoleGuard | admin | NoProjectData() | backups/backups.controller.ts |
| POST /backups/drive/test | JwtAuthGuard, RoleGuard | admin | NoProjectData() | backups/backups.controller.ts |
| DELETE /backups/drive | JwtAuthGuard, RoleGuard | admin | NoProjectData() | backups/backups.controller.ts |
| PUT /backups/settings | JwtAuthGuard, RoleGuard | admin | NoProjectData() | backups/backups.controller.ts |
| POST /backups/run | JwtAuthGuard, RoleGuard | admin | NoProjectData() | backups/backups.controller.ts |
| GET /builds | JwtAuthGuard | any signed-in | ProjectFrom(inQuery('projectId', 'project')) | builds/builds.controller.ts |
| GET /builds/:id | JwtAuthGuard | any signed-in | ProjectFrom(inParam('id', 'build')) | builds/builds.controller.ts |
| GET /builds/:id/overview | JwtAuthGuard | any signed-in | ProjectFrom(inParam('id', 'build')) | builds/builds.controller.ts |
| DELETE /builds/:id | JwtAuthGuard, RoleGuard | admin, editor | ProjectFrom(inParam('id', 'build')) | builds/builds.controller.ts |
| POST /builds | ApiGuard, RoleGuard | admin, editor | ProjectFromForAutotests(inBody('project', 'project')) | builds/builds.controller.ts |
| PATCH /builds/:id | MixedGuard, RoleGuard | admin, editor | ProjectFromForAutotests(inParam('id', 'build')) | builds/builds.controller.ts |
| PATCH /builds/:id/approve | JwtAuthGuard, RoleGuard | admin, editor | ProjectFrom(inParam('id', 'build')) | builds/builds.controller.ts |
| GET /ollama/models | JwtAuthGuard, RoleGuard | admin, editor | NoProjectData() | compare/libs/vlm/providers/ollama/ollama.controller.ts |
| POST /ollama/compare | JwtAuthGuard, RoleGuard | admin, editor | NoProjectData() | compare/libs/vlm/providers/ollama/ollama.controller.ts |
| GET /health | — | — | NoProjectData() | health/health.controller.ts |
| GET /projects | JwtAuthGuard | any signed-in | NoProjectData() | projects/projects.controller.ts |
| GET /projects/:id/devices | JwtAuthGuard | any signed-in | ProjectFrom(inParam('id', 'project')) | projects/projects.controller.ts |
| GET /projects/:id/jira/types | JwtAuthGuard, RoleGuard | admin, editor | ProjectFrom(inParam('id', 'project')) | projects/projects.controller.ts |
| POST /projects | JwtAuthGuard, RoleGuard | admin, editor | NoProjectData() | projects/projects.controller.ts |
| PUT /projects | JwtAuthGuard, RoleGuard | admin, editor | ProjectFrom(inBody('id', 'project')) | projects/projects.controller.ts |
| DELETE /projects/:id | JwtAuthGuard, RoleGuard | admin, editor | ProjectFrom(inParam('id', 'project')) | projects/projects.controller.ts |
| GET /projects/:id/access | JwtAuthGuard, RoleGuard | admin | ProjectFrom(inParam('id', 'project')) | projects/projects.controller.ts |
| PUT /projects/:id/access/:userId | JwtAuthGuard, RoleGuard | admin | ProjectFrom(inParam('id', 'project')) | projects/projects.controller.ts |
| DELETE /projects/:id/access/:userId | JwtAuthGuard, RoleGuard | admin | ProjectFrom(inParam('id', 'project')) | projects/projects.controller.ts |
| POST /builds/:id/report-links | JwtAuthGuard, RoleGuard | admin, editor | ProjectFrom(inParam('id', 'build')) | reports/reports.controller.ts |
| GET /builds/:id/report | JwtAuthGuard | any signed-in | ProjectFrom(inParam('id', 'build')) | reports/reports.controller.ts |
| GET /builds/:id/report-links | JwtAuthGuard | any signed-in | ProjectFrom(inParam('id', 'build')) | reports/reports.controller.ts |
| DELETE /report-links/:id | JwtAuthGuard | any signed-in | ProjectFrom(inParam('id', 'reportLink')) | reports/reports.controller.ts |
| GET /public/reports/:token | — | — | NoProjectData() | reports/reports.controller.ts |
| GET /images/:fileName | — | — | NoProjectData() | static/static.controller.ts |
| GET /images/:fileName/download | — | — | NoProjectData() | static/static.controller.ts |
| GET /test-runs | JwtAuthGuard | any signed-in | ProjectFrom(inQuery('buildId', 'build')) | test-runs/test-runs.controller.ts |
| GET /test-runs/groups | JwtAuthGuard | any signed-in | ProjectFrom(inQuery('buildId', 'build')) | test-runs/test-runs.controller.ts |
| GET /test-runs/:id | JwtAuthGuard | any signed-in | ProjectFrom(inParam('id', 'testRun')) | test-runs/test-runs.controller.ts |
| GET /test-runs/:id/a11y | MixedGuard | any signed-in | ProjectFrom(inParam('id', 'testRun')) | test-runs/test-runs.controller.ts |
| POST /test-runs/:id/a11y/ignore | JwtAuthGuard, RoleGuard | admin, editor | ProjectFrom(inParam('id', 'testRun')) | test-runs/test-runs.controller.ts |
| POST /test-runs/:id/a11y/reset | JwtAuthGuard, RoleGuard | admin, editor | ProjectFrom(inParam('id', 'testRun')) | test-runs/test-runs.controller.ts |
| POST /test-runs/:id/a11y/link | JwtAuthGuard, RoleGuard | admin, editor | ProjectFrom(inParam('id', 'testRun')) | test-runs/test-runs.controller.ts |
| POST /test-runs/:id/a11y/jira/prepare | JwtAuthGuard, RoleGuard | admin, editor | ProjectFrom(inParam('id', 'testRun')) | test-runs/test-runs.controller.ts |
| GET /test-runs/:id/a11y/jira/users | JwtAuthGuard, RoleGuard | admin, editor | ProjectFrom(inParam('id', 'testRun')) | test-runs/test-runs.controller.ts |
| POST /test-runs/:id/a11y/jira | JwtAuthGuard, RoleGuard | admin, editor | ProjectFrom(inParam('id', 'testRun')) | test-runs/test-runs.controller.ts |
| POST /test-runs/:id/element-rules | JwtAuthGuard, RoleGuard | admin, editor | ProjectFrom(inParam('id', 'testRun')) | test-runs/test-runs.controller.ts |
| POST /test-runs/:id/element-rules/remove | JwtAuthGuard, RoleGuard | admin, editor | ProjectFrom(inParam('id', 'testRun')) | test-runs/test-runs.controller.ts |
| POST /test-runs/:id/ignore-areas/replace-with-element | JwtAuthGuard, RoleGuard | admin, editor | ProjectFrom(inParam('id', 'testRun')) | test-runs/test-runs.controller.ts |
| GET /test-runs/:id/selector-matches | MixedGuard | any signed-in | ProjectFrom(inParam('id', 'testRun')) | test-runs/test-runs.controller.ts |
| GET /test-runs/:id/structure | MixedGuard | any signed-in | ProjectFrom(inParam('id', 'testRun')) | test-runs/test-runs.controller.ts |
| GET /test-runs/:id/trend | MixedGuard | any signed-in | ProjectFrom(inParam('id', 'testRun')) | test-runs/test-runs.controller.ts |
| POST /test-runs/approve | JwtAuthGuard, RoleGuard | admin, editor | ProjectFrom(inBody(undefined, 'testRuns')) | test-runs/test-runs.controller.ts |
| POST /test-runs/reject | JwtAuthGuard, RoleGuard | admin, editor | ProjectFrom(inBody(undefined, 'testRuns')) | test-runs/test-runs.controller.ts |
| POST /test-runs/undo/:decisionId | JwtAuthGuard, RoleGuard | admin, editor | ProjectFrom(inParam('decisionId', 'decision')) | test-runs/test-runs.controller.ts |
| POST /test-runs/delete | JwtAuthGuard, RoleGuard | admin, editor | ProjectFrom(inBody(undefined, 'testRuns')) | test-runs/test-runs.controller.ts |
| POST /test-runs/ignoreAreas/update | JwtAuthGuard, RoleGuard | admin, editor | ProjectFrom(inBody('ids', 'testRuns')) | test-runs/test-runs.controller.ts |
| POST /test-runs/ignoreAreas/add | JwtAuthGuard, RoleGuard | admin, editor | ProjectFrom(inBody('ids', 'testRuns')) | test-runs/test-runs.controller.ts |
| PATCH /test-runs/update/:testRunId | JwtAuthGuard, RoleGuard | admin, editor | ProjectFrom(inParam('testRunId', 'testRun')) | test-runs/test-runs.controller.ts |
| POST /test-runs | ApiGuard, RoleGuard | admin, editor | ProjectFromForAutotests(inBody('buildId', 'build'), inBody('projectId', 'project')) | test-runs/test-runs.controller.ts |
| POST /test-runs/multipart | ApiGuard, RoleGuard | admin, editor | ProjectFromForAutotests(inBody('buildId', 'build'), inBody('projectId', 'project')) | test-runs/test-runs.controller.ts |
| GET /test-variations | JwtAuthGuard | any signed-in | ProjectFrom(inQuery('projectId', 'project')) | test-variations/test-variations.controller.ts |
| GET /test-variations/details/:id | JwtAuthGuard | any signed-in | ProjectFrom(inParam('id', 'variation')) | test-variations/test-variations.controller.ts |
| GET /test-variations/merge | JwtAuthGuard, RoleGuard | admin, editor | ProjectFrom(inQuery('projectId', 'project')) | test-variations/test-variations.controller.ts |
| DELETE /test-variations/:id | JwtAuthGuard, RoleGuard | admin, editor | ProjectFrom(inParam('id', 'variation')) | test-variations/test-variations.controller.ts |
| POST /users | JwtAuthGuard, RoleGuard | admin | NoProjectData() | users/users.controller.ts |
| GET /users/accounts/enabled | — | — | NoProjectData() | users/users.controller.ts |
| POST /users/login | — | — | NoProjectData() | users/users.controller.ts |
| GET /users/oidc/enabled | — | — | NoProjectData() | users/users.controller.ts |
| GET /users/oidc/login | — | — | NoProjectData() | users/users.controller.ts |
| GET /users/oidc/callback | — | — | NoProjectData() | users/users.controller.ts |
| GET /users/me | JwtAuthGuard | any signed-in | NoProjectData() | users/users.controller.ts |
| GET /users/newApiKey | JwtAuthGuard | any signed-in | NoProjectData() | users/users.controller.ts |
| PUT /users/password | JwtAuthGuard | any signed-in | NoProjectData() | users/users.controller.ts |
| POST /users/logout | JwtAuthGuard | any signed-in | NoProjectData() | users/users.controller.ts |
| PUT /users/:id/password | JwtAuthGuard, RoleGuard | admin | NoProjectData() | users/users.controller.ts |
| PUT /users | JwtAuthGuard | any signed-in | NoProjectData() | users/users.controller.ts |
| PUT /users/jira | JwtAuthGuard | any signed-in | NoProjectData() | users/users.controller.ts |
| PUT /users/gemini | JwtAuthGuard | any signed-in | NoProjectData() | users/users.controller.ts |
| GET /users/all | JwtAuthGuard, RoleGuard | admin | NoProjectData() | users/users.controller.ts |
| DELETE /users | JwtAuthGuard, RoleGuard | admin | NoProjectData() | users/users.controller.ts |
| PATCH /users/assignRole | JwtAuthGuard, RoleGuard | admin | NoProjectData() | users/users.controller.ts |
| POST /test-runs/:id/bug/prepare | JwtAuthGuard, RoleGuard | admin, editor | ProjectFrom(inParam('id', 'testRun')) | visual-bugs/visual-bugs.controller.ts |
| POST /test-runs/:id/bug | JwtAuthGuard, RoleGuard | admin, editor | ProjectFrom(inParam('id', 'testRun')) | visual-bugs/visual-bugs.controller.ts |
| GET /test-runs/:id/bugs | JwtAuthGuard | any signed-in | ProjectFrom(inParam('id', 'testRun')) | visual-bugs/visual-bugs.controller.ts |

| WS subscribe {projectId} | handshake JWT + userForToken (052) | any signed-in | mayFollow(userId, projectId): admin або ProjectAccess | shared/events/events.gateway.ts:101 |

## Примітки
- Interceptor пропускає запит, якщо джерело не дало жодного проєкту (`if (!projectIds.length) return`, project-access.interceptor.ts:46): неіснуючий id → маршрут сам відповідає 404. Перевірено: усі маршрути з такими id роблять findUnique і падають/порожньо; обходу не знайдено.
- Пошук проєкту за назвою (POST /builds, POST /test-runs `projectId`) — однаковий у projectsOf і ProjectsService.findOne (точний збіг; uuid-подібне — лише як id).
- Multipart POST /test-runs/multipart: глобальний interceptor бачить порожнє тіло, тому ProjectAccessInterceptor повторено локально після FileToBodyInterceptor (test-runs.controller.ts:383-387).
- Guest (JwtAuthGuard без RoleGuard): POST /ai/group-summary, /ai/a11y-labels, /ai/bug-draft (VIS-SEC-026), GET /builds/:id/report-links (бачить токени публічних звітів, хоча створювати їх guest не може — REQ-031-69).
- DELETE /report-links/:id: JwtAuthGuard, але сервіс пускає лише автора або admin (reports.service.ts:67-74).
- POST /test-runs/undo/:decisionId: лише той, хто ухвалив рішення (decision-undo.service.ts:43).
- Editor: PUT/DELETE /projects для будь-якого доступного проєкту (VIS-SEC-041).
- Відповіді з користувачем — лише UserDto/UserLoginResponseDto або select без секретів; Session не віддається жодним маршрутом.
