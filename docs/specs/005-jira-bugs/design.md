# 005 — Дизайн

## Підхід

Усі виклики Jira — через `JiraClient` від імені того, хто діє. Текст і поля бага — чисті функції
(`jira-bug.ts`): вони отримують метадані екрана створення й таску і повертають поля для
`POST /issue`, поля для діалогу та відсутні поля. Діалог двічі звертається до сервера:
`prepare` (типи, поля, текст, наявні баги) і `file` (створення).

## Компоненти

| Компонент | Шлях | Роль |
|---|---|---|
| Клієнт | `backend/src/a11y/jira.client.ts` | `getIssue`, `issueTypes`, `createFields` (DC `values`, Cloud `issueTypes`/`fields` з пагінацією, Jira 8 createmeta), `findUsers`, `linkTypes`, `createIssue`, `link`, `assign`, `attach`, `editLabels`, `search` |
| Текст і поля | `backend/src/a11y/jira-bug.ts` | `functionalBlock`, `bugText`, `defaultIssueType`, `buildBugFields` (S4, «Замовник», копіювання, `inputs`, `missing`, `assignAfter`), `copyValue` |
| Сервіс | `backend/src/a11y/a11y-issues.service.ts` | `jiraFor` (особистий → спільний токен), `prepareBug`, `fileBug`, `outlineElement` |
| Токени | `backend/src/users/users.controller.ts` | `PUT /users/jira`; `UserDto.jiraTokenSet` |
| Діалог | `frontend/src/components/TestDetailsDialog/JiraBugDialog.tsx`, `JiraFieldInput.tsx` | вибір таски, типу, полів; пам'ять у `localStorage` |
| Профіль | `frontend/src/components/JiraTokenCard.tsx` | особистий токен і email |

## Дані

`User.jiraToken`, `User.jiraEmail`; `Project.jiraUrl`, `jiraToken` (спільний, необов'язковий),
`jiraEmail`, `jiraIssueType`, `jiraLinkType`. У браузері: таска для екрана, частота типів і
зв'язків, значення полів (`vision.jira.*`).

## Перевірка вимог

| Вимога | Перевірка |
|---|---|
| REQ-005-01 | `backend/src/a11y/a11y-problems.service.spec.ts › files as the person with their own token, else with the project` |
| REQ-005-04 | `backend/src/a11y/a11y-issues.spec.ts › uses basic auth when an email is set (Jira Cloud)` |
| REQ-005-02 | manual: користувач без токена в проєкті без спільного токена → підказка в рев'ю |
| REQ-005-03 | manual: `GET /users/me` повертає `jiraTokenSet` без токена; історія еталонів не віддає рядок користувача |
| REQ-005-10 | `backend/src/a11y/a11y-issues.spec.ts › reads issue types and create fields from the Jira 9 endpoints`; `backend/src/a11y/a11y-issues.spec.ts › reads Jira Cloud pages: issueTypes and fields lists, paged by total`; `backend/src/a11y/a11y-issues.spec.ts › falls back to the old createmeta call on Jira 8` |
| REQ-005-11 | `backend/src/a11y/jira-bug.spec.ts › prefers the configured type, then a bug sub-task, then a bug` |
| REQ-005-19 | manual: обрати інший тип двічі → наступного разу він перший |
| REQ-005-12 | `backend/src/a11y/jira-bug.spec.ts › puts a sub-task under the task instead of linking it`; `backend/src/a11y/a11y-issues.spec.ts › creates, links, assigns and attaches with the calls Jira expects` |
| REQ-005-13 | `backend/src/a11y/jira-bug.spec.ts › gives it to the task assignee, on the create screen or right after` |
| REQ-005-14 | `backend/src/a11y/jira-bug.spec.ts › sets severity S4, copies the customer and other required fields from the task` |
| REQ-005-15 | `backend/src/a11y/jira-bug.spec.ts › sets severity S4, copies the customer and other required fields from the task` |
| REQ-005-20 | `backend/src/a11y/jira-bug.spec.ts › offers severity, customer and empty required fields as inputs, and takes what is chosen`; `backend/src/a11y/a11y-issues.spec.ts › finds people for user fields with the user picker` |
| REQ-005-21 | manual: обрати «Замовника» → наступний діалог у проєкті підставляє його |
| REQ-005-16 | `backend/src/a11y/jira-bug.spec.ts › offers severity, customer and empty required fields as inputs, and takes what is chosen` (`missing`) |
| REQ-005-17 | `backend/src/a11y/jira-bug.spec.ts › sends only fields on the create screen` |
| REQ-005-18 | manual: повторне відкриття діалогу на тому ж екрані підставляє таску |
| REQ-005-30 | `backend/src/a11y/jira-bug.spec.ts › fills the template: service, screen, actual and expected result`; `backend/src/a11y/jira-bug.spec.ts › keeps the id whole in a long summary` |
| REQ-005-31 | `backend/src/a11y/jira-bug.spec.ts › fills the template: service, screen, actual and expected result`; `backend/src/a11y/jira-bug.spec.ts › goes into the summary and the description, with the component`; `backend/src/a11y/jira-bug.spec.ts › takes the service from the check name before the first dot` |
| REQ-005-32 | `backend/src/a11y/jira-bug.spec.ts › names them all once and lists every element as the actual result` |
| REQ-005-33 | `backend/src/a11y/a11y-issues.spec.ts › draws a frame around the element and leaves the rest of the screenshot alone` |
| REQ-005-34 | manual: Jira без прав на зв'язок → баг є, у діалозі попередження |
