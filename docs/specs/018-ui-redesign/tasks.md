# 018 — Задачі

Три шари з [design.md](design.md): основа → екрани → нова поведінка. Після кожного шару
застосунок робочий і всі наявні тести зелені. `[P]` — можна паралельно: задача не залежить від
інших незроблених і не чіпає їхніх файлів.

## Шар 1. Основа

- [x] **T1** (REQ-018-01, 07, 08, 20) Токени: `palette.light/dark`, `tokens` як `var(--v-*)`,
  `createAppTheme(mode)`, `cssVariables`, `useTokens`, `motion`; ESLint-заборона hex у
  компонентах.
  - Файли: `frontend/src/theme.ts`, `frontend/src/theme.test.ts`, `frontend/.eslintrc.cjs`.
  - Готово, коли: `theme.test.ts` зелений, наявні 25 помилок `tsc` не зросли.
- [x] **T2** (REQ-018-02…05) Вибір теми: чисті функції, контекст, ⇧D, коло View Transitions;
  `App.tsx` з `ThemeProvider` режиму й `GlobalStyles`.
  - Файли: `themeMode.helper.ts(+test)`, `contexts/themeMode.context.tsx`, `contexts/index.ts`,
    `App.tsx`.
  - Готово, коли: `themeMode.helper.test.ts` зелений; у браузері тема перемикається й лишається.
- [x] **T3** [P] (REQ-018-21, 23, 26, 27) Рух: `motion.helper.ts(+test)`, `useCountUp`,
  `Stagger`, глобальне правило reduced motion, відблиск у `SkeletonList`.
- [x] **T4** [P] (REQ-018-10…12) Знак «Гніздо» і словесний знак, favicon SVG і PNG (скрипт),
  шрифти Geist і JetBrains Mono з `@fontsource`.
  - Файли: `BrandMark.tsx(+test)`, `public/favicon.*`, `scripts/render-favicon.mjs`,
    `index.tsx`, `package.json`.
- [x] **T5** Data router: `createBrowserRouter` з одним маршрутом `*`.
  - Файли: `frontend/src/index.tsx`.
  - Готово, коли: `PrivateRoute.test.tsx` і Playwright-тести маршрутів зелені.
- [x] **T6** (REQ-018-22, 65) Шапка й навігація: кнопка теми, меню «?» і акаунта, підсвітка
  рейки, що переїжджає.
  - Файли: `Header.tsx`, `NavRail.tsx`, `Header.locators.ts`.

## Шар 2. Екрани

- [x] **T7** [P] (REQ-018-24, 66, 27) Спільне: `EmptyState`, `ErrorState`, вигляд діалогів (ріст
  з елемента), сповіщення.
- [x] **T8** [P] (REQ-018-60, 61) Збірка: смуга й лічильники, вкладки, групи змін, портретна
  сітка тестів, фільтри в рядок.
  - Файли: `ProjectPage.tsx`, `BuildList/`, `BuildDetails.tsx`, `ChangeGroups.tsx`,
    `TestRunList/`, `A11ySummary.tsx`.
- [x] **T9** [P] (REQ-018-30…36) Порівняння: `DiffMeter`, `StepDots`, `review.helper.ts(+test)`,
  підписи A і X, галочка, напрямок кроків, підсвітка рамок, кольори Konva з `useTokens()`.
  - Файли: `TestDetailsDialog/*`.
- [x] **T10** [P] (REQ-018-62, 63) Еталони й історія еталона.
  - Файли: `TestVariationListPage.tsx`, `TestVariationList.tsx`, `Filters.tsx`,
    `TestVariationMergeForm.tsx`, `TestVariationDetailsPage.tsx`, `TestVariationDetails.tsx`.
- [x] **T11** [P] (REQ-018-64) Insights: плитки, `insights.helper.ts(+test)`.
- [x] **T12** [P] (REQ-018-04, 68) Профіль: Appearance, API key з Show і Copy, вкладки прикладів.
  - Файли: `ProfilePage.tsx`, `JiraTokenCard.tsx`.
- [x] **T13** [P] (REQ-018-69) Бекапи: три картки, `backups.helper.ts(+test)`.
- [x] **T14** [P] Вхід і реєстрація, Manual checks.
  - Файли: `AuthLayout.tsx`, `LoginForm.tsx`, `RegisterForm.tsx`, `ManualChecksDialog.tsx`.
- [x] **T15** (REQ-018-67) Guided tour під новий вигляд. Після T6–T14.

## Шар 3. Нова поведінка

- [x] **T16** (REQ-018-40…51) Сторінка налаштувань: маршрут, розділи, пошук, движки, залежні
  поля, класи з нумерацією, панель збереження, `useBlocker`, Danger zone,
  `projectSettings.helper.ts(+test)`, `projectSettings.spec.ts`.
- [x] **T17** (REQ-018-52) Діалог нового проєкту; олівець і кошик у списку ведуть на сторінку й
  підтвердження назвою. Після T16.
- [x] **T18** [P] (REQ-018-53) Конфлікт збереження: `settings-conflict.ts(+spec)`, `loadedSettings`
  і `force` у `UpdateProjectDto`, 409 з назвами полів; на сторінці — вибір «перезавантажити» або
  «зберегти поверх».
- [x] **T19** [P] (REQ-018-71…73) Журнал рішень: міграція `ReviewDecision`, `decision-undo.ts`,
  `decision-undo.service.ts`, `decision-undo.spec.ts`, `{ decisionId }` з approve і reject,
  `POST /test-runs/undo/:decisionId`.
- [x] **T20** (REQ-018-70) Сповіщення з Undo в порівнянні, групах змін, рядку пристроїв і
  масових діях. Після T19.
  - Файли: `useDecisionSnackbar.tsx`, `undo.helper.ts(+test)`, `testRun.service.ts`,
    `ApproveRejectButtons.tsx`, `ChangeGroups.tsx`, `DeviceStrip.tsx`, `BulkOperation.tsx`.
- [x] **T21** [P] (REQ-018-80…82) Останній вхід: міграція `lastSignInAt`, запис у `login` і
  `oidcHandleCallback`, `UserDto`; у Users — пошук `users.helper.ts(+test)` і колонка.

## Завершення

- [x] **T22** Еталони скриншотів у Docker, кожен переглянутий (ADR-0011).
- [x] **T23** Документація: `design.md` «Перевірка вимог» звірена з назвами тестів, ADR-0014 і
  ADR-0015 → `Accepted`, `DEMO.md` (знімки, тема), `docs/architecture/data-model.md`
  (`ReviewDecision`, `lastSignInAt`), `docs/architecture/api.md` (undo, `decisionId`, конфлікт),
  статус spec → `Implemented`.
- [x] **T24** `/verify`: тести, типи, лінт, еталони, міграції, `check-docs.py`, сценарії
  приймання на дев-стенді. Усе, крім дев-стенда: його не запускали, сценарії приймання там —
  за людиною.
