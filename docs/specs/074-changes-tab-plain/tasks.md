# 074 — Задачі

- [x] **T1** [P] (REQ-074-04) `inlineDiff` у `wordDiff.helper` і `BeforeAfter` одним рядком.
  - Готово, коли: тест `wordDiff.helper.test.ts › puts removed words…` зелений.
- [x] **T2** [P] (REQ-074-01, 03, 08, 13, 21, 30) `showVerdict`, `changeMark`, `ignoreZoneGroups`,
  `mostOfScreen`, `bugStandsOut`, один заголовок для нестабільного тексту у `whatsCompared.helper`.
  - Готово, коли: нові тести `whatsCompared.helper.test.ts` зелені.
- [x] **T3** [P] (REQ-074-10) `variableShown` у `variableText.helper`.
  - Готово, коли: тест `variableText.helper.test.ts › shows the baseline value…` зелений.
- [x] **T4** (REQ-074-05…08, 10…12, 14, 15) `WhatsCompared` і `ComparedMap`: без кнопки й підсумку,
  схема ліворуч, «Зони ігнорування» з підзаголовками, новий рядок нестабільного тексту з ✓ і
  меню ⋯, без підказки «Якщо це баг…».
- [x] **T5** (REQ-074-01…03, 30, 31) `InsightsPanel`: порядок, підзаголовок «Зміни», квадратики,
  без смужки, картка «Змінився майже весь екран».
- [x] **T6** (REQ-074-15, 20, 21) `TestDetailsModal`: кнопка бага завжди, неактивна без Jira,
  червона за `bugStandsOut`; `onEditRule`.
- [x] **T7** (REQ-074-32) тексти в `en.ts` і `uk.ts`.
- [x] **T8** Тести Playwright: нові сценарії з «Перевірки вимог», старі перевірки `invisibleStrip`,
  `comparedToggle`, `comparedSummary`, `outsideToggle`, «Було/Стало» оновлено.
- [x] **T9** Документація: статус spec → `Implemented`, позначки «Замінено» в 025, 030, 033, 036,
  069.
- [x] **T10** `/verify`.

Скриншот-еталони (`project-page-test-run-details*.png`, `…-overlay.png`, `…-difference.png`)
не перегенеровано: у сесії, де робилась зміна, не було Docker. Кнопка «Завести баг» тепер видна
й без адреси Jira, тож ці знімки зміняться — `./test-docker.sh --update-snapshots`.
