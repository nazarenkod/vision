# 038 — Дизайн

## Підхід

Огляд лишається тим самим екраном (плитки, таблиці функціоналу й пристроїв, баги); змінюються
вага нулів, згортання фіч і з'являється картка доступності. Макет —
[канва](https://claude.ai/artifact/4PeWijwNarnPhLGdLQ2RWk).

- **Тихі нулі.** `Tiles` отримав прапорець `quiet`: без фону, пунктирна рамка, сіре число й
  підпис, атрибут `data-quiet` для тестів. Огляд ставить його кожній плитці з нулем, крім «Екрани».
  Вкладка Accessibility прапорця не ставить і не змінюється.
- **Нулі в таблицях.** `Num` отримав `zero` (типово «—», як і досі на Accessibility і у звіті);
  таблиці Overview передають `"0"`. Порожнє число напівпрозоре, щоб ненульові виділялись.
- **Усі фічі.** Сервер і далі віддає `features` (зі змінами, відсортовані) і `quietFeatures`
  (решта за назвою), бо звіт згортає їх у «+N passed». Overview просто показує обидва списки
  поспіль, кнопки згортання більше немає.
- **Тривалість.** Чиста `buildDuration` поряд із `buildPeriod`; шапка збірки з'єднує їх « · ».
  Звіт тривалості не показує.
- **Проблеми доступності.** Сервіс огляду вже читає звіти доступності знімків збірки заради багів
  Jira (`jiraBugsOn`). Той самий прохід тепер повертає ще й проблеми (`findingsOn`): кожне
  пораховане порушення (без порад `info` і хибних) — правило, назва елемента, нова чи відома.
  «Нова» — те саме, що рахує `a11yNewCount`: статус `new` і жодного рішення. Чиста `a11yOf`
  додає перевірку й пристрій, сортує (нові першими, далі перевірка, пристрій, правило), обрізає до
  20 і рахує решту. Кеш огляду на 60 с тепер тримає і баги, і проблеми.
- **Картка.** `A11yProblems` у правій колонці під пристроями й багами: шапка таблиці, рядок —
  правило (перекладене через `RULE_LABEL` з налаштувань норм), під ним «перевірка · елемент»,
  теги пристрою, `StatusPill` «Нова»/«Відома» притиснутий праворуч. Клік — `openA11y(runId)`:
  знімок на вкладці Accessibility. Без проблем — один рядок з іконкою (як «немає багів», який
  теж отримав іконку); без UI-дерев — картки немає.

## Компоненти

| Компонент | Шлях | Роль |
|---|---|---|
| `findingsOf`, `elementNameOf` | `backend/src/a11y/a11y-issues.ts` | пораховані проблеми переглянутого звіту; назва елемента: підпис → id без пакета → клас |
| `A11yIssuesService.findingsOn` | `backend/src/a11y/a11y-issues.service.ts` | замість `jiraBugsOn`: баги Jira й проблеми за один прохід звітів |
| `a11yOf` | `backend/src/builds/build-overview.ts` | рядки картки, обрізання до 20, `checked` |
| `BuildOverviewService` | `backend/src/builds/build-overview.service.ts` | поле `a11y` у відповіді, кеш разом із багами |
| Публічний звіт | `backend/src/reports/report-links.ts` | тип без `a11y`; поля перелічені явно, тож проблеми туди не потрапляють |
| `buildDuration` | `frontend/src/_helpers/buildPeriod.helper.ts` | «3 хв 34 с» |
| `Tiles` (`quiet`), `Num` (`zero`) | `frontend/src/components/SummaryParts.tsx` | тихі плитки, «0» замість «—» |
| Огляд | `frontend/src/components/BuildOverview/index.tsx` | усі фічі, `A11yProblems`, `EmptyLine` |
| Дії огляду | `frontend/src/pages/ProjectPage.tsx` | `openA11y` |

## Дані

Схема бази не змінюється. `GET /builds/:id/overview` отримує поле
`a11y: { checked, problems: [{ testRunId, rule, element, isNew, check, device, os }], more }`.
Назва елемента — дані з UI-дерева знімка, тож у публічний звіт поле не йде (REQ-038-09).

Ключі словника: `builds.duration*`, `overview.a11yState`, `overview.a11yIssueNew`,
`overview.a11yIssueKnown`, `overview.noA11y`, `overview.a11yMore`.

## Ризики

- Огляд читає звіти лише знімків з проблемами, як і раніше; більше файлів не відкривається.
- Збірка з тисячами проблем: на клієнт іде 20 рядків, сортування — на сервері.

## Перевірка вимог

| Вимога | Перевірка |
|---|---|
| REQ-038-01 | `frontend/integration_tests/test/buildOverview.spec.ts › lets the tiles with nothing to see step back` |
| REQ-038-02 | `frontend/integration_tests/test/buildOverview.spec.ts › shows every feature at once, those with changes first` |
| REQ-038-03 | `frontend/integration_tests/test/buildOverview.spec.ts › explains a result bar and shows zeros as a faint 0` |
| REQ-038-04 | `frontend/src/_helpers/buildPeriod.helper.test.ts › says hours and minutes, minutes and seconds, or seconds alone`; `frontend/src/_helpers/buildPeriod.helper.test.ts › says nothing for a build that has not run on since it started` |
| REQ-038-05 | `backend/src/a11y/a11y-issues.spec.ts › lists the counted problems, new only when nobody acted on them`; `backend/src/a11y/a11y-issues.spec.ts › leaves false positives out`; `backend/src/a11y/a11y-issues.spec.ts › names the element by its label, else its id without the package, else its class`; `backend/src/builds/build-overview.spec.ts › lists every problem of every screenshot with its check and device, new first`; `frontend/integration_tests/test/buildOverview.spec.ts › lists the accessibility problems, new first, and opens one on its tab` |
| REQ-038-06 | `backend/src/builds/build-overview.spec.ts › shows 20 problems, new first, and counts the rest`; `frontend/integration_tests/test/buildOverview.spec.ts › counts the accessibility problems past twenty and opens the tab for them` |
| REQ-038-07 | `frontend/integration_tests/test/buildOverview.spec.ts › lists the accessibility problems, new first, and opens one on its tab` |
| REQ-038-08 | `backend/src/builds/build-overview.spec.ts › says nothing was checked when no screenshot came with a UI tree`; `frontend/integration_tests/test/buildOverview.spec.ts › says there are no accessibility problems in one line, and nothing without UI trees` |
| REQ-038-09 | `backend/src/reports/report-links.spec.ts › leaves the accessibility problems of the overview out of a public report` |
