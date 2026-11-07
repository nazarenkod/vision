# backend — NestJS 12 + Prisma 7 + Postgres

Загальні правила — у [../AGENTS.md](../AGENTS.md). Тут лише те, що стосується бекенду.

## Модулі Vision

| Модуль | Відповідає за | Специфікація |
|---|---|---|
| `src/ui-tree/` | прийом дерева з лімітами (`ui-tree.intake.ts`: ≤ 10 МиБ розпакованого, без `DOCTYPE`), розбір Appium page source, налаштування порівняння, правила елементів, приховані зміни, групи компонентів; селектори `xpath:` для безіменних елементів (`xpath-selector.ts`, `selector-variants.ts`); перевірка нестабільного тексту (`variable-text.ts`) | [002](../docs/specs/002-ui-tree-analysis/spec.md), [020](../docs/specs/020-remove-reference-device/spec.md), [027](../docs/specs/027-nameless-elements/spec.md), [033](../docs/specs/033-variable-text/spec.md), [040](../docs/specs/040-uitree-limits-and-sdk-names/spec.md) |
| `src/a11y/a11y.rules.ts` | правила доступності | [003](../docs/specs/003-accessibility-checks/spec.md) |
| `src/a11y/a11y-norms.ts` | норми проєкту (зона тапу, контраст, вимкнені правила); `applyNorms` — звіт за поточними нормами всюди, де його показують чи рахують | [026](../docs/specs/026-a11y-rules-settings/spec.md) |
| `src/a11y/a11y-problems.ts`, `a11y-issues*.ts` | проблеми, їхні ID і факти, групування, маркери, рішення, пошук у Jira | [004](../docs/specs/004-a11y-problems/spec.md), [021](../docs/specs/021-fixed-a11y-grouping/spec.md) |
| `src/a11y/jira*.ts` | клієнт Jira, поля й текст бага; `jira-hosts.ts` — лише хости з `VISION_JIRA_HOSTS`, перевірка в `jiraAccess` і при збереженні проєкту | [005](../docs/specs/005-jira-bugs/spec.md), [044](../docs/specs/044-secrets-at-rest/spec.md) |
| `src/shared/secret-box.ts`, `api-key-hash.ts`, `secrets-at-rest.service.ts` | секрети в базі: токени й ключі Gemini — `sealSecret`/`openSecret` (AES-256-GCM ключем `VISION_SECRET_KEY`, без нього API не стартує), API-ключі — `sha256:`; при старті відкриті значення шифруються, а відкриті API-ключі анулюються | [044](../docs/specs/044-secrets-at-rest/spec.md) |
| `src/test-runs/change-groups.service.ts` | групи змін збірки | [006](../docs/specs/006-change-groups/spec.md) |
| `src/test-runs/decision-undo*.ts` | журнал Approve і Reject та Undo з нього ([ADR-0014](../docs/decisions/0014-undo-through-decision-journal.md)); тест відновлення ганяє справжній успадкований approve | [018](../docs/specs/018-ui-redesign/spec.md) |
| `src/projects/allowed-devices.ts` | дозволені пристрої проєкту: збіг пристрою й OS (`26.*`), текст відмови 422 для SDK; CLI (`User-Agent: vision-cli/…`) не перевіряється | [029](../docs/specs/029-allowed-devices/spec.md) |
| `src/projects/settings-conflict.ts`, `project-secrets.ts` | збереження налаштувань поверх чужих змін (409), ключ Gemini лише на запис | [018](../docs/specs/018-ui-redesign/spec.md) |
| `src/analytics/` | Insights | [008](../docs/specs/008-insights/spec.md) |
| `src/ai/` | AI на вимогу, кеш, ліміт; чернетка бага на особистому ключі Gemini (`personalGeminiKey`) | [010](../docs/specs/010-ai-assist/spec.md), [025](../docs/specs/025-bug-from-comparison/spec.md) |
| `src/visual-bugs/` | баг із порівняння: назва, опис із розділами, позначки на знімку, баги перевірки | [025](../docs/specs/025-bug-from-comparison/spec.md) |
| `src/builds/build-overview*.ts` | зведення збірки для Overview і звіту: чиста `buildOverview`, сервіс вантажить рядки; баги й проблеми доступності (`a11yOf`, лише Overview, не публічний звіт) — з файлів звітів за один прохід, кеш за збіркою | [031](../docs/specs/031-build-overview/spec.md), [039](../docs/specs/039-overview-polish/spec.md) |
| `src/reports/` | публічні посилання на звіт, `report-links.ts` — білий список полів публічного звіту; `GET /public/reports/:token` — єдиний маршрут з даними без входу ([ADR-0022](../docs/decisions/0022-public-report-links.md)) | [031](../docs/specs/031-build-overview/spec.md) |
| `src/projects/project-access*.ts` | доступ до проєктів: `@ProjectFrom(...)` / `@NoProjectData()` на кожному маршруті, `ProjectAccessInterceptor` перевіряє до обробника (адмін — усе, решта — рядок `ProjectAccess`), `404`, для автотестів `403` | [042](../docs/specs/042-project-access/spec.md) |
| `src/shared/server-secrets.ts` | секрети при старті: `JWT_SECRET` і `VISION_SECRET_KEY` не з прикладу, ≥ 32 символи й різні, інакше API не стартує | [051](../docs/specs/051-security-quick-fixes/spec.md) |
| `src/ui-tree/linear-regex.ts` | вирази правил (`text:/…/`, нестабільний текст) — на RE2 з лінійним часом, з перекладом зі значення JavaScript; зворотні посилання й перевірки вперед і назад — відмова | [051](../docs/specs/051-security-quick-fixes/spec.md) |
| `src/users/sign-in-limit.ts`, `account.ts`, `src/security.ts`, `src/http-exception.filter.ts` | вхід і API назовні: 5 спроб за 15 хв, пароль ≥ 12, LDAP чи SSO поряд з локальними акаунтами; CORS лише для `APP_FRONTEND_URL`, Swagger за `VISION_SWAGGER`, заголовки безпеки; помилка — `{ statusCode, message, path }` | [045](../docs/specs/045-sign-in-and-api-hardening/spec.md) |
| `src/compare/` | піксельне порівняння (успадковане + області змін, пул воркерів); пул виконує й правила доступності (`src/a11y/a11y.job.ts`), а завдання довше за `DIFF_JOB_TIMEOUT_MS` (60 с) зупиняє й не повторює | — |
| `src/static/file-links*.ts`, `static.controller.ts` | знімки лише за підписом: `FileLinksInterceptor` додає `fileSignatures` у відповіді маршрутів з guard-ом, сокет і публічний звіт — самі; `/images/:name?sig=` віддає PNG, решта — 404 | [043](../docs/specs/043-protected-images/spec.md) |
| `src/shared/events/` | сокет подій: вхід JWT на рукостисканні (`events-auth.ts`, `AuthService.verifyToken`), розрив на `exp`, підписка `subscribe` і розсилка в кімнату проєкту (`events-rooms.ts`) | [032](../docs/specs/032-authenticated-events/spec.md) |
| `src/backups/` | сторінка Backups: стан бекапу, вхід у Google Drive кодом, розклад і запит на бекап у файлах для `scripts/vision-backup.sh` (ADR-0013) | [013](../docs/specs/013-backups-and-secrets/spec.md), [017](../docs/specs/017-backup-settings-ui/spec.md) |

## Команди

```bash
npm test                                   # unit-тести src/ (те, що ганяємо завжди)
npx tsc --noEmit -p tsconfig.json          # типи; помилки в prisma/test/seed.spec.ts — апстрім, не наші
npx eslint src
npx prettier --write <змінені файли>       # не по всьому src: не чіпаємо чужий код
npx prisma generate                        # після зміни schema.prisma
npm run test:e2e / test:acceptance         # потрібні запущені Postgres і API, див. docs/guides/testing.md
../scripts/control-scenario.sh             # контрольний сценарій test_control/ проти еталона (Docker, Java)
```

## Правила

- **Міграції** пишемо руками в `prisma/migrations/<YYYYMMDDHHMMSS>_<назва>/migration.sql`, лише
  додавальні (нова таблиця, nullable-колонка, індекс), з коментарем, чому це безпечно.
  Після зміни схеми — `npx prisma generate`, а фікстури `User`/`Project` у специфікаціях
  доповнюємо новими полями.
- **Чиста логіка окремо від сервісів.** Правила, ідентичність проблем, текст бага, Insights — це
  чисті функції (`*.ts` без Nest), сервіс лише завантажує дані й викликає їх. Тестуємо чисті
  функції напряму, а сервіси — з моками Prisma і `fetch`.
- **Звіти й дерева — у файлах, у базі — лічильники.** Сокет-шлюз розсилає рядок `TestRun`
  цілком, тож великий JSON у колонку не кладемо.
- **Jira:** усі виклики — через `JiraClient`, від імені того, хто діє (`userId` → особистий токен;
  спільного токена проєкту немає, ADR-0025). Збій міток чи вкладень — попередження у відповіді, а не помилка.
- **Нова подія наживо — лише в кімнату проєкту** (`projectRoom`), не `server.emit`: сокет
  пускає лише тих, хто увійшов, і кожен отримує свій проєкт ([ADR-0023](../docs/decisions/0023-events-socket-behind-login.md)).
- **Не повертай рядок `User` цілком** (хеш пароля, API-ключ, токен Jira): лише `select` потрібних
  полів або `UserDto`.
- **Новий секрет у базі** — через `sealSecret` при записі й `openSecret` лише там, де він іде назовні;
  у тестах ключ задає `src/jest.setup.ts`.
- **Тіло запиту — DTO-клас, кожне поле з декоратором class-validator** (`@IsOptional()`, `@Allow()` для файла):
  `StripUnknownFieldsPipe` (`src/shared/strip-unknown-fields.pipe.ts`) пропускає далі лише оголошені поля,
  тож поле без декоратора до обробника не дійде. Тіло без класу (`string[]`, інлайн-тип) перевіряй руками й
  додай маршрут у `CHECKED_BY_HAND` у `strip-unknown-fields.pipe.spec.ts`: тест падає на тілі без оголошених полів.
  Застосунок і e2e ставлять одні й ті самі `globalPipes()`.
- **Новий маршрут — з `@ProjectFrom(...)` або `@NoProjectData()`** (`src/projects/project-access.ts`):
  `project-access.routes.spec.ts` падає на маршруті без позначки й перевіряє відмову на кожному.
  Маршрут, що читає тіло пізніше (multipart), додає `ProjectAccessInterceptor` після свого (042).
- **Нове поле з іменем знімка** — додай його в `FILE_FIELDS` (`src/static/file-links.ts`), інакше
  інтерфейс не відкриє файл. Маршрут без guard-а підписів не отримує (043).
- Коментарі пояснюють *чому*, а не *що*.

## Пастки

- **Node 24.9+** (`.nvmrc`, `nvm use`): Nest 12 — лише ES-модулі, а Jest 30 вантажить їх через
  `require(esm)` тільки з цієї версії; на старішому Node тести падають з «Must use import to load
  ES Module». Код компілюється в CommonJS, Node сам підтягує ESM-пакети. `npm run build` — це
  `tsc -p tsconfig.build.json` (без Nest CLI), результат у `dist/main.js`.
- **Prisma 7:** адреса бази — у `prisma.config.ts` (у `schema.prisma` її немає), клієнт ходить через
  `@prisma/adapter-pg` (`PrismaService`, `prisma/client.ts`). Генератор лишився `prisma-client-js`,
  тож імпорти — як і раніше, з `@prisma/client`; помилки — `Prisma.PrismaClientKnownRequestError`.
- **`overrides` у `package.json`** піднімають транзитивні dev-залежності до версій без вразливостей;
  `deepmerge` — виправлена копія у `vendor/` (виправленого релізу немає, див. її README).
- `npx jest` без `--projects src` запускає ще e2e й acceptance, і вони падають без бази.
  Один файл — `npm test -- --testPathPatterns <шлях>` (Jest 30): голий шлях після `--projects src` jest
  вважає ще одним проєктом і падає з «jest is not defined».
- **Знімки поведінки** `src/ui-tree/__snapshots__/structure.characterization…` і
  `src/shared/__snapshots__/screenshot-limits.characterization…` фіксують, що пропонує вигляд
  структури, що знаходять селектори правил і як приймаються PNG. Змінився знімок — змінилась
  поведінка: це специфікація, а не `jest -u`.
- **Вираз із правила — лише через `compileLinear`** (`src/ui-tree/linear-regex.ts`), не `new RegExp`:
  інакше повільний вираз однієї команди зупиняє API для всіх (051). Змінюєш переклад — диференційний
  тест `linear-regex.spec.ts` порівнює з `RegExp`.
- **Список у тілі запиту з `@ArrayMaxSize`** перевіряє `ListLengthPipe` ще до `ValidationPipe`:
  довгий список не перевіряється поелементно. Областей ігнорування — не більше 20 (`MAX_IGNORE_AREAS`).
- **`VISION_JIRA_HOSTS`:** ім'я хоста — лише `https` на 443; інший порт чи `http` — запис
  `схема://хост:порт`. Клієнт Jira не йде за переадресацією (051).
- **PNG декодуємо лише через `readPng`** (`src/shared/screenshot-limits.ts`): він перевіряє ліміт
  пікселів за кожним IHDR файла і не дає interlaced PNG розпакуватися більше, ніж обіцяє заголовок
  (VIS-SEC-045). Канва порівняння різних розмірів — не більше двох лімітів.
- `parseUiTreeSettings` відкидає записи, яких не розуміє. Додаючи поле в налаштування проєкту,
  онови й парсер, і його тест (`comparison-inputs.spec.ts`).
- Нове поле в публічному звіті (`src/reports/report-links.ts`) бачать люди без акаунта: лише
  свідомо, з рядком у білому списку й тестом «keeps emails, keys and tokens out…».
- Approve вихідного проєкту змінить щось нове (поле варіації, ще одну таблицю) — онови `decision-undo.ts`;
  `decision-undo.spec.ts` порівнює стан до approve і після undo й про це скаже.
- Кеш індексу проблем (`A11yIssuesService.indexFor`) скидається після кожного запису в цьому
  сервісі. Пишеш в `A11yProblem` деінде — виклич `forget(projectId)` або перевір версію.
