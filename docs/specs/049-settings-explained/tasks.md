# 049 — Задачі

- [ ] **T1** (REQ-049-01, 03, 13) Бекенд: `allIssueTypes`, `jiraTypesFor`, `settingsJira`, `GET /projects/:id/jira/types`.
  - Файли: `backend/src/a11y/jira.client.ts`, `jira-types.ts`, `jira-access.ts`, `backend/src/projects/projects.controller.ts`.
  - Готово, коли: `jira-access.spec.ts` і `jira-types.spec.ts` зелені.
- [ ] **T2** [P] (REQ-049-02, 06, 08) Фронтенд: тип `JiraTypes`, `getJiraTypes`, `jiraTypeOptions`.
  - Готово, коли: `jiraTypes.helper.test.ts` зелений.
- [ ] **T3** (REQ-049-01, 04, 05, 07, 09) Списки в `JiraSettings`, підказка без токена, «Спробувати ще», перезавантаження після виходу з поля.
  - Готово, коли: тести Jira в `projectSettings.spec.ts` зелені.
- [ ] **T4** [P] (REQ-049-10…12) Назва «Структура екрана», опис, старі назви в пошуку.
  - Готово, коли: тест пошуку й тест назви зелені.
- [ ] **T5** [P] (REQ-049-20…28) `explainerScenes`, `OptionExplainer`, «?» біля чотирьох опцій.
  - Готово, коли: `explainerScenes.test.ts`, `OptionExplainer.test.tsx` і тест у `projectSettings.spec.ts` зелені.
- [ ] **T6** Документація: позначити «Замінено» в REQ-018-41 і REQ-035-30, статус 049 → `Implemented`.
- [ ] **T7** `/verify`.
