# 042 — Дизайн

## Підхід

**Дані (REQ-042-10, 11).** Нова таблиця `ProjectAccess` (`userId`, `projectId`, `grantedById`,
`createdAt`; ключ — пара, каскадне видалення з користувачем і проєктом). Міграція створює її й
тим самим запитом дає кожному наявному користувачу доступ до кожного наявного проєкту: Prisma
виконує міграцію рівно раз, тож пізніше відкликаний доступ не повертається, а свіжа копія бази
VRT отримує свій перший запуск. Це лише додавання рядків у нову таблицю (ADR-0003). Нові
користувачі рядків не мають.

**Звідки маршрут бере проєкт (REQ-042-01, 02, 08).** Кожен маршрут контролера має одне з двох:
`@ProjectFrom(...)` — де в запиті проєкт і що це (`project`, `build`, `testRun`, `testRuns`,
`variation`, `decision`, `reportLink`; з `param`, `query` чи `body`), або `@NoProjectData()`.
Тест обходить усі контролери й падає, якщо маршрут без жодного. Глобальний
`ProjectAccessInterceptor` (після guard-ів, тож користувач уже відомий) знаходить проєкти
запиту й пускає адміна завжди, а решту — лише з рядком доступу до кожного. Інакше `404 Not found`: за відповіддю
не видно, чи проєкт існує. Запис, якого немає, обробляє сам маршрут, як і раніше.
`ApiGuard` тепер кладе користувача ключа в `request.user`, тож ключ має рівно доступ свого
власника.

**Автотести (REQ-042-09).** `POST /builds`, `POST /test-runs`, `/test-runs/multipart` мають
`refuse: 'forbidden'`: `403` «No access to project …: ask an admin to add you». SDK і CLI
показують це повідомлення. Нічого не створюється: перевірка до обробника.

**Переліки (REQ-042-01, 04).** `GET /projects` — лише проєкти з доступом (адміну — усі). Решта
переліків уже в межах одного проєкту чи збірки й проходить через перехоплювач.

**Події (REQ-042-03).** `subscribe` перевіряє доступ так само; коли доступ забирають, сокети
людини виходять з кімнати проєкту.

**Керування (REQ-042-05, 06, 07).** `GET /projects/:id/access`, `PUT` і `DELETE
/projects/:id/access/:userId` — лише адмін. `POST /projects` від editor-а дає авторові доступ.
`GET /users/all` віддає `projects` кожного (`[{ id, name }]`). В інтерфейсі: розділ «Доступ» у
налаштуваннях проєкту (лише адміну), стовпець «Проєкти» на сторінці Users, порожній перелік
проєктів з підказкою звернутися до адміна.

**Публічний звіт (REQ-042-12).** Маршрут без входу, `@NoProjectData()`: доступ — за токеном.

## Компоненти

| Компонент | Шлях | Роль |
|---|---|---|
| `ProjectFrom`, `NoProjectData`, `projectAccessOf` | `backend/src/projects/project-access.ts` | опис маршрутів, рішення |
| `ProjectAccessService` | `backend/src/projects/project-access.service.ts` | пошук проєктів запиту, доступ, надання |
| `ProjectAccessInterceptor` | `backend/src/projects/project-access.interceptor.ts` | перевірка до обробника |
| контролери | `backend/src/**/*.controller.ts` | `@ProjectFrom` / `@NoProjectData` |
| сокет | `backend/src/shared/events/events.gateway.ts` | доступ при підписці, вихід при відкликанні |
| інтерфейс | `frontend/src/components/ProjectForm/ProjectAccessSettings.tsx`, `UserList`, `ProjectListPage` | доступ, стовпець, підказка |

## Дані

Таблиця `ProjectAccess`, міграція `20261105130000_add_project_access` (з наповненням).

## Ризики

| Ризик | Що робимо |
|---|---|
| Новий маршрут без перевірки | тест обходу контролерів вимагає позначки на кожному |
| Люди після переходу бачать усе, як раніше | так і задумано (US-4); адмін звужує доступ у налаштуваннях |
| Підписи знімків (043), отримані до відкликання | діють, доки живий файл: так вирішено в 043; нових людина не отримає |

## Перевірка вимог

| Вимога | Перевірка |
|---|---|
| REQ-042-01 | `backend/src/projects/projects.controller.spec.ts › lists only the projects a person has access to` |
| REQ-042-02 | `backend/src/projects/project-access.routes.spec.ts › answers not found on every route of a project without access` |
| REQ-042-03 | `backend/src/shared/events/events.gateway.spec.ts › subscribes only to a project the person has access to and leaves it when access goes` |
| REQ-042-04 | `backend/src/projects/project-access.spec.ts › lets an admin into every project without a grant` |
| REQ-042-05 | `frontend/integration_tests/test/projectSettings.spec.ts › lets an admin give and take access to the project` |
| REQ-042-06 | `frontend/integration_tests/test/userList.spec.ts › shows the projects each user has access to` |
| REQ-042-07 | `backend/src/projects/projects.controller.spec.ts › gives an editor access to the project they create` |
| REQ-042-08 | `backend/src/projects/project-access.interceptor.spec.ts › gives an API key the access of its owner` |
| REQ-042-09 | `backend/src/projects/project-access.interceptor.spec.ts › refuses an autotest a project without access before anything is made` |
| REQ-042-10 | `scripts/tests/test_project_access_migration.py › test_gives_everyone_every_project_once` |
| REQ-042-11 | `backend/src/projects/project-access.spec.ts › gives a new account no project` |
| REQ-042-12 | `backend/src/projects/project-access.routes.spec.ts › keeps the public report open by its token` |
