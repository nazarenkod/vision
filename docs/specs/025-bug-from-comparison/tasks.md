# 025 — Задачі

<!-- [P] — можна робити паралельно: не залежить від інших і не чіпає тих самих файлів. -->

## Назва фічі

- [x] **T1** [P] (REQ-025-70, REQ-025-73) SDK: `featureName` у `TestRunOptions`, `TestRunRequest`,
  `VisualRegressionTracker`; версія `4.3.1-vision.N+1` у `scripts/build-sdk-jar.sh`.
  - Файли: `sdk-java/src/main/java/...`, `sdk-java/src/test/java/.../VisualRegressionTrackerTest.java`,
    `scripts/build-sdk-jar.sh`, `sdk-java/AGENTS.md`, `DEPLOY.md` (приклади з `.featureName(...)`).
  - Готово, коли: `gradle test` зелений, тест без `featureName` бачить запит без цього ключа; `git diff`
    `sdk-java/` проти upstream містить лише `uiTree` і `featureName`.
- [x] **T2** [P] (REQ-025-71, REQ-025-72) Бекенд: міграція `TestRun.featureName` і таблиця
  `VisualBug`, `prisma generate`; `featureName` у DTO прийому (JSON і multipart), у рядку прогону й
  `TestRunDto`; пошук варіації не змінюється.
  - Файли: `backend/prisma/schema.prisma`, `backend/prisma/migrations/<час>_add_visual_bugs/migration.sql`,
    `backend/src/test-runs/dto/*`, `backend/src/test-runs/test-runs.service.ts` і його spec, `backend/src/test-variations/test-variations.service.spec.ts`.
  - Готово, коли: тест «compares with the same baseline whether a feature is sent or not» зелений.

## Бекенд бага

- [x] **T3** [P] (REQ-025-13, REQ-025-20, REQ-025-21, REQ-025-27, REQ-025-28, REQ-025-71) Чисті
  функції тексту: `featureOf`, `bugSummary`, `environmentText`, `bugDescription`.
  - Файли: `backend/src/visual-bugs/visual-bug.ts` і `visual-bug.spec.ts`.
  - Готово, коли: тести з «Перевірки вимог» для цих REQ зелені.
- [x] **T4** [P] (REQ-025-12) `markImage`: рамки й кружки з номерами на PNG.
  - Файли: `backend/src/visual-bugs/mark-image.ts` і spec.
  - Готово, коли: тест «draws a numbered frame and leaves the rest alone» зелений.
- [x] **T5** (REQ-025-23, REQ-025-24) `buildBugFields`: необов'язкова серйозність, `BugInput.role`;
  поведінка для a11y без змін (наявні тести `jira-bug.spec.ts` зелені).
  - Файли: `backend/src/a11y/jira-bug.ts`, `backend/src/a11y/jira-bug.spec.ts`.
- [x] **T6** (REQ-025-25) Винести `jiraFor` у `JiraAccessService`; `A11yIssuesService` користується
  ним.
  - Файли: `backend/src/a11y/jira-access.service.ts`, `backend/src/a11y/a11y-issues.service.ts`,
    модуль a11y, spec-и сервісу.
  - Готово, коли: `npm test` зелений без змін у тестах a11y, крім підстановки сервісу.
- [x] **T7** (REQ-025-12, REQ-025-25, REQ-025-32, REQ-025-35, REQ-025-60) Сервіс і контролер `visual-bugs`:
  `prepare`, `file`, `forCheck`; запис `VisualBug`. Залежить від T2–T6.
  - Файли: `backend/src/visual-bugs/visual-bugs.service.ts`, `visual-bugs.controller.ts`,
    модуль, spec з моками Prisma і `fetch`; `docs/architecture/api.md`, `docs/architecture/data-model.md`.

## AI

- [x] **T8** [P] (REQ-025-42, REQ-025-44) Чисті функції чернетки: `draftSchema`, `draftPrompt`,
  `cropAreas`.
  - Файли: `backend/src/visual-bugs/bug-draft.ts` і spec.
- [x] **T9** (REQ-025-40, REQ-025-47, REQ-025-48) `AiFeaturesService.draftBug` і
  `POST /ai/bug-draft`: лише Gemini, номер спроби в ключі кешу, тайм-аут 30 с. Залежить від T8.
  - Файли: `backend/src/ai/ai-features.service.ts`, `backend/src/ai/ai.controller.ts`,
    `backend/src/ai/ai.service.spec.ts`.

## Фронтенд

- [x] **T10** [P] (REQ-025-10, REQ-025-22, REQ-025-24, REQ-025-26, REQ-025-40, REQ-025-41,
  REQ-025-45, REQ-025-46, REQ-025-48) Чисті функції: `bugReport.helper.ts`, `elementAt` у
  `elementAt` з `elementPicking.helper.ts` (024), `jiraMemory.ts` (винесено з `JiraBugDialog`, який далі ним користується).
  - Готово, коли: `CI=true npx jest` зелений.
- [x] **T11** (REQ-025-01, REQ-025-02, REQ-025-05) Нижня панель порівняння за макетом, клавіша `B`,
  стан без токена. Залежить від T10.
  - Файли: `TestDetailsModal.tsx`, `ApproveRejectButtons.tsx`, `en.ts`, `uk.ts`.
- [x] **T12** (REQ-025-10, REQ-025-11, REQ-025-26, REQ-025-30, REQ-025-33, REQ-025-34,
  REQ-025-43) `ReportBugDialog` і `BugEvidence`: форма, позначки, Checkpoint / Baseline,
  створення, відхилення через наявний reject, сповіщення з ключем і Undo; блок AI з T9.
  Залежить від T7, T9, T10.
  - Файли: нові компоненти, `frontend/src/types/insights.ts`, `frontend/src/services/insights.service.ts`,
    `en.ts`, `uk.ts`.
- [x] **T13** (REQ-025-03, REQ-025-04, REQ-025-60, REQ-025-61) Входи зі зміни й зі сповіщення
  Reject; чип багів, розділ «Bugs for this screen», позначки багів на чекпоінті з перемикачем.
  Залежить від T12.
  - Файли: `InsightsPanel.tsx`, `useDecisionSnackbar.tsx`, `TestDetailsModal.tsx`, `DrawArea.tsx`.
- [x] **T14** Playwright: `frontend/integration_tests/test/reportBug.spec.ts` з моками API за
  «Перевіркою вимог»; скриншот-еталони діалогу порівняння оновити в Docker
  ([ADR-0011](../../decisions/0011-screenshot-baselines-in-docker.md)), переглянувши знімки.

## Особистий ключ Gemini

- [x] **T17** (REQ-025-40, REQ-025-42, REQ-025-47, REQ-025-48, REQ-025-49) `User.geminiApiKey`,
  `PUT /users/gemini`, `UserDto.geminiKeySet`; `AiService.generateJson({ personalGeminiKey })` і
  `draftBug` на ключі людини поза денним лімітом інстансу; картка Gemini в профілі; у діалозі AI
  лише з ключем, інакше підказка ([ADR-0020](../../decisions/0020-personal-gemini-keys.md)).

## Завершення

- [x] **T15** Документація: «Перевірка вимог» — кожен «план:» стає `шлях › назва`, нові шляхи
  в Компонентах — у лапках; глосарій; статус spec → `Implemented`; `DEPLOY.md` про новий jar.
- [x] **T16** `/verify`: тести, типи, лінт, еталони скриншотів, `scripts/check-docs.py`, сценарії
  приймання на тестовій Jira (manual-рядки).
