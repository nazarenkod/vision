# Вихідні з'єднання Vision: що, куди, коли (коміт 7b13af1)

Агент D, 2026-11-05. Лише читання коду, жодного мережевого запиту. «При прийомі» — під час
`POST /test-runs` від SDK/CLI без участі людини (правило 6 / ADR-0007 таке забороняє).

## Сервер (backend, контейнер `api`)

| Куди (хост) | Звідки (файл:рядок) | Коли | Які дані | Чим вмикається / вимикається | Типове значення |
|---|---|---|---|---|---|
| `generativelanguage.googleapis.com` (Gemini) | `backend/src/compare/libs/vlm/providers/gemini/gemini.service.ts:44`; виклик з `compare/libs/vlm/vlm.service.ts:90`, ланцюжок `test-runs.controller.ts:353` → `test-runs.service.ts:140` → `:347` → `compare.service.ts:30-32,62-63` | **при прийомі** (кожен знімок із пікселевою різницею), а також у auto-approve для кожної минулої базової лінії (`test-runs.service.ts:149-150,803`), при зміні правил чи областей ігнорування (`:628,643,698`, `test-variations.service.ts:228`) | **повні PNG**: базова лінія і новий знімок (області ігнорування зафарбовані), diff-зображення; промпт проєкту; ключ Gemini проєкту | налаштування проєкту: `imageComparison=vlm` + `imageComparisonConfig.provider="gemini"` + `apiKey`; змінює будь-який editor проєкту (`PUT /projects`). Вимикача на рівні інстансу **немає**, `AI_PROVIDER` не впливає | вимкнено (`imageComparison` типово `pixelmatch`, `schema.prisma:39`) |
| `OLLAMA_BASE_URL` (типово `host.docker.internal:11434` — хост машини) | `compare/libs/vlm/providers/ollama/ollama.service.ts:18,52`; той самий ланцюжок, що вище | **при прийомі** (VLM з `provider` `ollama` або без provider — це типовий для VLM, `vlm.service.ts:32-38,115`) | ті самі три повні PNG і промпт | `imageComparison=vlm` у проєкті; адреса — змінна `OLLAMA_BASE_URL` | VLM вимкнено; `OLLAMA_BASE_URL=http://host.docker.internal:11434` (`docker-compose.demo.yml:64`) |
| `OLLAMA_BASE_URL` | `compare/libs/vlm/providers/ollama/ollama.controller.ts:30-73` (`GET /ollama/models`, `POST /ollama/compare`) | на вимогу (admin/editor) | 2 довільні зображення від користувача, промпт; список моделей | роль admin/editor; адреса з середовища | доступно, якщо Ollama слухає |
| `generativelanguage.googleapis.com` (Gemini, ключ інстансу) | `backend/src/ai/ai.service.ts:123-138` з `ai-features.service.ts:103-114` (group-summary), `:128-139` (візуальна група), `:162-175` (a11y-labels) | на вимогу (кнопка в рев'ю; будь-яка роль, включно з guest — без `@Roles`) | group-summary структурна: до 15 змін «елемент: було → стало» (тексти екрана), назви екранів; візуальна: 2 вирізки області змін + назва екрана; a11y-labels: вирізки до 8 елементів (≤128 px) + до 12 текстів екрана (по 40 символів) | `AI_PROVIDER=gemini` + `GEMINI_API_KEY`; денний ліміт `AI_DAILY_CALL_LIMIT`; кеш за вмістом | вимкнено: `AI_PROVIDER=none` (`docker-compose.demo.yml:61`, `ai.service.ts:54`) |
| `OLLAMA_BASE_URL` (AI інстансу) | `ai.service.ts:132-138` | на вимогу | ті самі дані, що в рядку вище | `AI_PROVIDER=ollama` + `OLLAMA_BASE_URL` | вимкнено |
| `generativelanguage.googleapis.com` (Gemini, **особистий** ключ) | `ai.service.ts:101-106,123-131` з `ai-features.service.ts:189-236` (`POST /ai/bug-draft`) | на вимогу (Fill with AI у діалозі бага) | до 3 областей × 2 вирізки (baseline і новий знімок, ≤384 px), нотатка людини (≤2000 символів), назва перевірки, feature, до 15 текстів змін (≤200 символів) | особистий ключ Gemini у профілі (`PUT /users/gemini`, `users.controller.ts:232`). **`AI_PROVIDER=none` не вимикає** (ADR-0020) | вимкнено, доки людина не збереже ключ |
| Jira (хост з `VISION_JIRA_HOSTS`, адреса — `Project.jiraUrl`) | `backend/src/a11y/jira.client.ts:101-105`; через `a11y/jira-access.ts:19-44` з `visual-bugs/visual-bugs.service.ts:106,162,214`, `a11y/a11y-issues.service.ts:698,1079` | на вимогу (завести баг, знайти дублікати, мітки) | особистий токен Jira (Bearer PAT або Basic email:token); поля бага (назва, опис з кроками, оточенням, назвою перевірки, посиланням на Vision); **вкладення**: повний знімок з позначками (`visual-bugs.service.ts:243`) і базова лінія (`:250`), знімок перевірки доступності (`a11y-issues.service.ts:1026-1031`); JQL-пошуки з кодами проблем | `VISION_JIRA_HOSTS` (порожньо = жодного звернення); `jiraUrl` проєкту; токен у профілі. Перевіряється лише hostname — схема, порт і редиректи ні | вимкнено: `VISION_JIRA_HOSTS` порожній (`docker-compose.demo.yml:54`) |
| `oauth2.googleapis.com` | `backend/src/backups/backups.service.ts:159,191,232,284` (`drive-auth.ts:9-11`) | на вимогу (admin підключає Drive; оновлення access token при перегляді сторінки Backups) | client_id, client_secret OAuth-клієнта, device code, refresh token (при revoke — у query-рядку) | маршрути `/backups/drive/*` (лише admin); `BACKUP_CONFIG_DIR` | доступно admin-у, Drive не підключено |
| `www.googleapis.com/drive/v3` | `backups.service.ts:245,304,319` | на вимогу (сторінка Backups: список і тест папки) | access token; метадані файлів бекапу | підключений Drive | не підключено |
| Redis (`REDIS_URL`) | `backend/src/redis-io.adapter.ts:22` | постійно, якщо задано | події сокета (рядки `TestRun` цілком, події проєктів) | `REDIS_URL` | не задано в `docker-compose.demo.yml` (у dev-compose — `redis://redis:6379` без пароля) |
| AWS S3 (`AWS_*`) | `backend/src/static/aws/s3.service.ts:26` | при прийомі й читанні (якщо обрано) | усі знімки, diff, дерева, звіти | `STATIC_SERVICE=s3` | `hdd` (`static.factory.ts:14`) |
| OIDC issuer (`OIDC_ISSUER_URL`, далі `token_endpoint`, `jwks_uri`, `userinfo` з discovery) | `backend/src/users/oidc/oidcusers.service.ts:97` | при вході через SSO | код авторизації, client_secret, ID-токен | `OIDC_ENABLED=true` | `false` |
| LDAP (`LDAP_URL`) | `backend/src/users/ldap/ldapusers.service.ts:44-49` | при вході | bind-обліковий запис і пароль людини | `LDAP_ENABLED=true` | `false` |

## Хост (скрипти, cron)

| Куди (хост) | Звідки (файл:рядок) | Коли | Які дані | Чим вмикається / вимикається | Типове значення |
|---|---|---|---|---|---|
| Google Drive (через rclone) | `scripts/vision-backup.sh` (`--scheduled` з cron кожні 5 хв бере час зі сторінки Backups), `scripts/lib/vision-backup.sh:147-160` | **cron** (щодня у вибраний час, типово 03:17) і на вимогу (кнопка, `POST /backups/run`) | незашифрований tar: `db.dump` (усі таблиці, крім рядків `User`/`Project`: збірки, назви перевірок, `vlmDescription`, `A11yProblem.facets`/`screenTitle`, `AiResult.payload`, `VisualBug.summary`, `ReportLink.token`), `user.csv` (email, імена, хеші API-ключів; паролі й токени затерто), `project.csv` (налаштування, зашифрований ключ Gemini проєкту), `manifest.txt`. Скриншотів і дерев немає | Drive підключено на сторінці Backups або `BACKUP_REMOTE` у `.env.demo`; рядок у crontab | вимкнено (порожній `BACKUP_REMOTE`, Drive не підключено) |
| Docker Hub (`postgres:16-alpine` за тегом, `rclone/rclone:1.68.2`) | `scripts/lib/vision-safety.sh:96`, `scripts/demo-clone-from-prod.sh:139`, `scripts/lib/vision-backup.sh:146,154` | при копії проду з `PROD_DATABASE_URL`, при бекапі без rclone на хості | pull образу; образ отримує рядок підключення до проду / токени Drive | `PROD_DATABASE_URL` замість `PROD_PG_CONTAINER`; відсутність rclone на хості | лише якщо обрано ці режими |

## Збірка образів і розробка

| Куди (хост) | Звідки (файл:рядок) | Коли | Які дані | Чим вмикається / вимикається | Типове значення |
|---|---|---|---|---|---|
| `registry.npmjs.org` | `backend/Dockerfile:19-22`, `backend/prisma/Dockerfile:17-20`, `frontend/Dockerfile:18-21`, `frontend/.npmrc` | `vision.sh up --build` | запити пакетів | `VISION_NPM_REGISTRY` (дзеркало банку) | публічний реєстр |
| `binaries.prisma.sh` | `backend/prisma/Dockerfile:12,20` (`prisma generate`), postinstall `backend/package.json` | збірка образу міграцій, `npm ci` у backend | завантаження рушіїв Prisma | `VISION_PRISMA_ENGINES_MIRROR` | публічний |
| Телеметрія Prisma (`checkpoint.prisma.io`) | Prisma CLI | збірка | версія, ОС | `CHECKPOINT_DISABLE=1` (`backend/Dockerfile:10,32`, `backend/prisma/Dockerfile:12`) | вимкнено в образах; у dev без змінної — увімкнено |
| Scarf (`@scarf/scarf` через `swagger-ui-dist`) | install-скрипт пакета | `npm ci` у backend | телеметрія встановлення | `SCARF_ANALYTICS=false` (`backend/Dockerfile:10`); `allowScripts: {"@scarf/scarf": false}` — чи враховує npm, не перевірено | вимкнено в образі; у dev — залежить від npm |
| Install-скрипти `@google/genai`, `protobufjs`, `@parcel/watcher` | `backend/package-lock.json` (`hasInstallScript`) | `npm ci` | невідомо (без node_modules не перевірено) | `allowScripts` у `package.json` (див. вище) | — |
| CDN Playwright (браузери) | `frontend/package.json:48` (`test:pw:install`) | розробка/CI | завантаження Chromium **без перевірки TLS** | ручний запуск скрипта | — |
| `services.gradle.org`, `repo.maven.apache.org`, `plugins.gradle.org` | `sdk-java/gradle/wrapper/gradle-wrapper.properties:2`, `sdk-java/build.gradle:10-29` | збірка SDK (`scripts/build-sdk-jar.sh`, системний gradle; `./gradlew` — Gradle 6.1 без контрольної суми) | завантаження залежностей | `VISION_GRADLE_FLAGS=--offline` | мережа |
| GitHub (`actions/checkout@v4`, `actions/setup-python@v5`) | `.github/workflows/docs.yml:12-13` | push/PR | код репозиторію в GitHub Actions | наявність workflow | увімкнено |

## Клієнти (поза сервером)

| Куди (хост) | Звідки (файл:рядок) | Коли | Які дані | Чим вмикається / вимикається | Типове значення |
|---|---|---|---|---|---|
| API Vision (адреса з `--api` / `VISION_API`) | `frontend/public/cli/vision.py:94-102` | на вимогу (CLI, MCP) | API-ключ у заголовку `apiKey` (іде й на адресу редиректу), знімки, дерева | конфіг CLI `~/.config/vision/config.json` (0600) | приклад у довідці — `http://` |
| Appium (`--appium`) | `vision.py:210-217` | на вимогу | page source, скриншот пристрою | параметр | `http://127.0.0.1:4723` у прикладі |
| API Vision | SDK `sdk-java` (`VISION_*`) | у тестах команд | знімки, `uiTree` до 10 МиБ | налаштування SDK | — |

## Висновки для ІБ

1. Єдиний автоматичний (без людини) вихід даних назовні — **VLM-рушій проєкту при прийомі**
   (повні скриншоти в Gemini або Ollama). Його вмикає editor проєкту; вимикача на рівні
   інстансу немає; `AI_PROVIDER=none` на нього не впливає.
2. `AI_PROVIDER=none` вимикає лише AI інстансу; особисті ключі Gemini (чернетки багів) працюють
   незалежно (ADR-0020).
3. Повністю заборонити Gemini налаштуваннями Vision зараз неможливо — лише мережевим
   egress-фільтром хоста (заблокувати `generativelanguage.googleapis.com`, `*.googleapis.com`,
   якщо Drive теж не погоджено).
4. Бекап у Google Drive не містить паролів і токенів, але містить персональні дані співробітників,
   тексти з екранів, відкриті токени публічних звітів і не шифрується (ADR-0012).
