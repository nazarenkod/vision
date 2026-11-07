# Промт проведення security audit Vision

Цей файл зберігає завдання (промт), за яким проведено повторний аудит безпеки Vision.
Результати аудиту — поруч у цій же теці `audit/` (звіт `report.pdf`, `findings.json`, модель загроз,
SBOM, сирі виводи сканерів). Аудит виконано на коміті `7b13af1`.

---

## Контекст (заповнено з репозиторію; перевір позначене `[?]` перед запуском)

- **Продукт:** Vision — візуальні перевірки для QA мобільних застосунків (AOS/iOS, Appium +
  Selenide). Похідний твір від Visual Regression Tracker (Apache-2.0), див. `NOTICE`. Це власний
  продукт, а не «форк, який синхронізуємо з upstream» (ADR-0027).
- **Склад коду:** монорепо `nazarenkod/vision`:
  - `backend/` — NestJS + Prisma + Postgres 16 + Redis (адаптер socket.io), Node 24;
  - `backend/prisma/` — окремий migration-образ і окремий `package.json`;
  - `frontend/` — React 18 + MUI 5 + Vite, nginx-unprivileged; CLI і MCP-сервер `frontend/public/cli/vision.py` (Python, лише stdlib);
  - `sdk-java/` — Java SDK `ua.vision:vision-sdk` (Gradle);
  - `scripts/` — `vision.sh`, копія даних з робочого VRT, бекапи/відновлення, `lib/vision-safety.sh`;
  - `ssl/` — конфіги nginx; `docker-compose.demo.yml` (поставка), `backend/docker-compose*.yml` (dev/тести, моки LDAP і OIDC);
  - `.github/workflows/docs.yml` — єдиний CI; `.claude/` — хуки агентів.
- **Модель розгортання:** внутрішній on-prem сервіс у **банківському контурі**, кілька команд
  банку, доступ за ролями `admin` / `editor` / `guest` і за проєктами. Стоїть **на тій самій
  машині, що й робочий VRT**, і працює на копії його бази й картинок. У контур іде знімок дерева
  **без історії git** (`scripts/export-without-history.sh`). `[?]` Чи передається код/образи
  банку як іншій юрособі (тобто чи це «дистрибуція» для ліцензій) — уточни в мене.
- **Дані:** скриншоти й **UI-дерева (XML з текстом екранів)** мобільних застосунків банку;
  можуть містити ПІБ, номери карток і рахунків, баланси, телефони — вважай це персональними й
  банківськими даними. Також: звіти доступності, баги Jira, рішення команди, публічні звіти збірок.
- **Зовнішні інтеграції:** Jira Cloud/DC (особисті токени, allowlist `VISION_JIRA_HOSTS`);
  Gemini (VLM-движок порівняння з ключем проєкту + чернетки багів з особистими ключами);
  Ollama (`OLLAMA_BASE_URL`); LDAP (`ldapts`) і OIDC/SSO (`openid-client`) разом із локальними
  акаунтами; бекапи в Google Drive **без шифрування** (ADR-0012); Redis. S3 — є код (`static/aws`), але відкладено.
- **Попередній аудит:** `docs/security/audit-2026-11-04.md` (знахідки S-1…S-15) і
  `docs/security/bank-readiness-plan.md`. Більшість виправлено специфікаціями 040, 042–045;
  свідомо лишились S-12 (`OIDC_TLS_NO_VERIFY`), S-13 (токен у localStorage), S-14 (bcrypt cost 10).
- **Поза скоупом:** робочий VRT, його база, контейнери й папка картинок — **не чіпати взагалі,
  навіть на читання**; реальна Jira, Google Drive, Gemini; GitHub-репозиторій (налаштування,
  гілки, issues).
- `[?]` **Сканування Docker-образів (`trivy image`)** — у плані підготовки це «лише з дозволу
  власника». Дозвіл: `[так / ні]`.

## Роль і мета

Ти — senior application security engineer. Проведи повний security audit Vision перед
перенесенням у банківський контур. Це **повторний** аудит: перевір, що виправлення S-1…S-15
справді працюють, і знайди те, чого попередній аудит не покрив (він не мав SAST, сканера образів,
транзитивних залежностей Gradle та історії git). Результат — PDF-звіт українською, придатний для
керівництва, ІБ банку та юристів, плюс технічні додатки для розробників.

## Правила роботи

Спершу прочитай `AGENTS.md` (кореневий і пакетів) — його непорушні правила мають пріоритет над
цим промтом.

1. **Read-only щодо коду продукту.** Нічого не виправляй, не комміть, не пушь, не створюй гілок і
   PR. Усі артефакти — лише в `audit/` у корені репозиторію (не комітиться); тимчасове — у
   scratchpad сесії. Чи переносити звіт у `docs/security/`, вирішу я.
2. **Робочий VRT не повинен постраждати (правило 1, ADR-0002).** Жодних звернень до продових
   контейнерів, бази чи папки картинок; жодного `scripts/demo-clone-from-prod.sh`,
   `vision-backup.sh`, `vision-restore.sh`. `docker compose` — лише через `./scripts/vision.sh`;
   `.claude/hooks/guard.py` блокує решту — не обходь його, а запиши як обмеження.
3. **Динамічні перевірки — лише на локальному стенді** за `docs/guides/development.md`: Postgres
   в окремому контейнері (`docker run … postgres:16` на вільному порту), API й UI нативно, свій
   `JWT_SECRET`/`VISION_SECRET_KEY`. Дані — лише синтетичні (seed, `backend/test/`). Без
   навантажувальних і DoS-тестів довше кількох секунд. Якщо стенд не піднімається (немає демона
   Docker тощо) — зафіксуй як обмеження і спирайся на e2e-тести (`backend/test/*.e2e-spec.ts`) та
   юніт-тести (`backend/src/security.spec.ts` тощо).
4. **Жодних дій назовні (правило 8):** не надсилай реальні запити в Jira, Gemini, Google Drive,
   не публікуй виводи сканерів у сторонні сервіси (без `--upload`, без SaaS-режимів semgrep/snyk).
5. **Кожна знахідка має доказ:** `файл:рядок`, фрагмент коду, вивід інструмента або кроки
   відтворення на стенді. Без доказу — «потребує перевірки», не знахідка.
6. **Не вигадуй.** Рівень впевненості — High / Medium / Low. Кожен результат сканера переглянь
   вручну й познач false positive з причиною. Відомі свідомі рішення (ADR у `docs/decisions/`)
   не видавай за «знахідку, про яку не знали»: оцінюй ризик рішення і посилайся на ADR.
7. **Інструменти:** якщо немає — встанови (npm у scratchpad, `pip --break-system-packages`,
   бінарник з GitHub Releases). Не встановлюй нічого в `package.json` пакетів і не запускай
   `npm install` так, щоб змінились lock-файли. Не вдалося — пропусти крок і зазнач у звіті.
   Chromium уже є: для mermaid-cli/puppeteer — `executablePath: /opt/pw-browsers/chromium`,
   `--no-sandbox`.
8. Спершу увійди в **plan mode**, склади план і покажи мені. Після підтвердження виконуй. Для
   незалежних напрямів етапу 2 використовуй паралельні subagents; кожен отримує цей контекст і
   правила 1–7 і повертає знахідки у форматі з розділу «Формат знахідки».
9. Веди `audit/PROGRESS.md` — що зроблено, що лишилось, щоб аудит можна було продовжити.

## Етап 0 — Розвідка

- Інвентаризація: сервіси, мови, фреймворки, точки входу — REST-контролери, шлюз socket.io,
  публічні маршрути (публічні звіти за токеном, підписані посилання на знімки), `@nestjs/schedule`
  (cron), пул воркерів порівняння, CLI/MCP, Java SDK, скрипти хоста й **файловий канал
  «інтерфейс → скрипти хоста»** для бекапів (ADR-0013); Dockerfile-и, compose-файли, nginx,
  CI, `.env*.example`, `.claude/hooks`.
- Звір очікуване з реальністю: ELK, `vrt-install.sh` і кореневий compose за попереднім аудитом
  прибрано; `ssl/` має лише конфіги nginx — перевір, що ключів і сертифікатів у дереві й історії
  немає; провайдери порівняння — pixelmatch / looks-same / odiff-bin / VLM (Gemini).
- Модель загроз (STRIDE) в `audit/threat-model.md` з Mermaid-діаграмою потоків:
  - активи: знімки й UI-дерева банківських застосунків, еталони, рішення команди, секрети
    (`JWT_SECRET`, `VISION_SECRET_KEY`, токени Jira, ключі Gemini, ключ Google Drive), хеші API-ключів;
  - ролі: anonymous, власник посилання на публічний звіт, guest, editor, admin, API-ключ
    (SDK/CLI), адміністратор хоста, адмін бази;
  - межі довіри: SDK/CLI → API, браузер → nginx → API, API → Postgres/Redis/диск, API → Jira /
    Gemini / Ollama / LDAP / OIDC / Google Drive, API ↔ скрипти хоста через файли, Vision ↔
    робочий VRT на тій самій машині (спільні диск, CPU, Docker);
  - потоки: прийом знімка (`POST /test-runs` з `uiTree`) → порівняння → звіт доступності →
    рев'ю в UI → баг у Jira / чернетка через LLM → публічний звіт → бекап.
  За основу візьми `docs/architecture/overview.md`, `data-model.md`, `api.md`.

## Етап 1 — Автоматизовані сканування

Сирі виводи — в `audit/raw/`. Пакети: `backend`, `backend/prisma`, `frontend`, `sdk-java`,
`frontend/public/cli`, `scripts`.

| Напрям | Інструменти |
|---|---|
| Вразливі залежності | `npm audit --json` (prod і dev окремо) у трьох npm-пакетах; `osv-scanner -r .`; для `sdk-java` — `trivy fs` / `osv-scanner` по Gradle, за можливості `./gradlew dependencies` для транзитивних |
| SAST | `semgrep --config p/owasp-top-ten --config p/nodejs --config p/typescript --config p/react --config p/secrets --config p/java --config p/python --config p/dockerfile`; `bandit -r frontend/public/cli`; `shellcheck scripts/*.sh scripts/lib/*.sh` |
| Секрети (з історією git) | `gitleaks detect --log-opts="--all"`, `trufflehog git file://. --only-verified`. Історія в контур не йде, але є на GitHub — знахідки в історії оцінюй окремо |
| Контейнери та IaC | `trivy fs .`, `trivy config .`, `hadolint` для `backend/Dockerfile`, `backend/prisma/Dockerfile`, `frontend/Dockerfile`; `trivy image` — лише якщо дозвіл у контексті «так» і образи збираються локально без впливу на прод |
| Ліцензії залежностей | `license-checker --json` (або `npx license-report`) для трьох npm-пакетів; Gradle — звіт ліцензій плагіном або вручну по `build.gradle`; SBOM CycloneDX: `npx @cyclonedx/cyclonedx-npm` по кожному пакету або `syft dir:.`, злитий у `audit/sbom.cdx.json` |

Звір результати з попереднім аудитом («`npm audit` = 0», перелік ліцензій) і поясни розбіжності.

## Етап 2 — Ручний аудит

### 2.0 Регресія попереднього аудиту
Для кожної S-1…S-15 з `docs/security/audit-2026-11-04.md`: чи виправлення на місці, чи є тест,
чи немає обходу. Перевір вимоги специфікацій 040, 042, 043, 044, 045 (кожен `REQ-…` проти коду й
тесту з `design.md`). Окремо переоціни S-12, S-13, S-14 для банківського контуру.

### 2.1 Автентифікація
- JWT: `JWT_SECRET` обов'язковий, алгоритм, `JWT_LIFE_TIME`, відкликання при logout/зміні
  пароля/блокуванні/зміні ролі; уже видані токени й сокет-з'єднання.
- Локальні акаунти + LDAP + SSO разом (045): прив'язка зовнішньої особи до локального акаунта,
  LDAP-ін'єкція, TLS LDAP/OIDC, `OIDC_TLS_NO_VERIFY`, `state`/`nonce`/PKCE, redirect URI.
- Акаунти лише від адміністратора (035, ADR-0025): seed першого адміна.
- Паролі: `bcryptjs` cost, мінімум 12, ліміт 5/15 хв (по IP чи акаунту, обхід через `X-Forwarded-For`),
  енумерація, скидання.
- API-ключі: ентропія, хешування (044), видимість, прив'язка, ротація.

### 2.2 Авторизація та ізоляція проєктів (042)
- Guards і `@Roles` на кожному ендпоінті, включно з socket.io (032).
- IDOR за ID / вкладеними ресурсами / пошуком / групами змін / Insights / MCP; чи може API-ключ
  проєкту A писати в B; фільтрація Prisma за доступними проєктами.
- Mass assignment: `whitelist`/`forbidNonWhitelisted`; зміна `role`, `projectId`, власника.
- Правило 7: рядок `User` ніколи не віддається цілком, токени Jira лише записуються.

### 2.3 Знімки, UI-дерева й файли
- Ліміти тіла/розміру/розмірів PNG (decompression bomb), тип за вмістом; `uiTree` — gzip-бомба,
  ліміт 10 МиБ (040), XXE/billion laughs, глибина. DoS порівнянням, odiff-bin. Path traversal.
- Роздача знімків (043): підпис, строк дії, прив'язка, кеш, CORS, обхід через `/images/:name`/nginx.
- Публічні звіти (ADR-0022). Ignore regions, XPath (ADR-0021), ReDoS, вендорений deepmerge.

### 2.4 LLM, VLM і зовнішні виклики
- Що йде за межі контуру (Gemini, Jira, Google Drive); per-project/per-instance вимикач, `AI_PROVIDER=none`.
- Правило 6 (ADR-0007): LLM ніколи при прийомі, включно з VLM-движком.
- SSRF: `OLLAMA_BASE_URL`, хости Jira (`VISION_JIRA_HOSTS` — редиректи, DNS rebinding, IP, IPv6, `@`).
- Секрети провайдерів: шифрування at rest (044), логування. Prompt injection. Google Drive бекапи (ADR-0012).

### 2.5 Ін'єкції та обробка вводу
- Prisma `$queryRaw`/`$executeRaw`/`$queryRawUnsafe`. XSS у React. Ін'єкції в Jira (ADF/JQL),
  у скриптах хоста (файловий канал бекапів). CLI/MCP. Open redirect, header injection, CSV, ReDoS.

### 2.6 Конфігурація та HTTP-шар
- CORS, заголовки (`security.ts`) — CSP, HSTS, `X-Frame-Options`, `Referrer-Policy`; nginx (`ssl/`).
- Токен у localStorage (S-13), CSRF. Swagger за прапорцем, помилки без stack. `trust proxy`. Логи.

### 2.7 Інфраструктура та supply chain
- compose-файли: публікація портів, дефолтні паролі, user, ліміти, digest, Redis, мережі.
- `scripts/`: `vision-safety.sh`, генерація секретів, права файлів, `curl | sh`, `export-without-history.sh`.
- CI: pinning actions за SHA, права `GITHUB_TOKEN`. Lock-файли, postinstall, typosquatting,
  Gradle wrapper. `.claude/hooks/*`.

### 2.8 Комерційне використання та банківський контур (окремий розділ звіту)
- Apache-2.0: `LICENSE`/`NOTICE` у корені, пакетах, образах, jar; copyright-заголовки; примітка про
  зміни; атрибуція deepmerge. Бренд «Visual Regression Tracker» (grep по коду/UI/i18n/образах).
- Ліцензії залежностей: copyleft/обмежувальні в prod vs dev; звірка з попереднім аудитом. Шрифти OFL.
- Чужий контент: тестові скриншоти, внутрішні хости/email.
- Персональні/банківські дані: Закон України «Про захист персональних даних», GDPR, НБУ, PCI DSS
  (контрольні питання, без юридичних висновків; познач, що потребує юриста). Мінімізація, строки,
  видалення, аудит-лог. Шифрування at rest / in transit.
- Чого бракує для банку: аудит-логи безпеки, моніторинг, політика сесій, ротація секретів, реагування.

## Формат знахідки

Кожна знахідка — і в `audit/findings.json`, і у звіті:

- `id` — `VIS-SEC-001`…
- `previous_id` — `S-n` з аудиту 2026-11-04, якщо та сама проблема, інакше `null`
- `title` — коротка назва українською
- `severity` — Critical / High / Medium / Low / Info
- `cvss` — вектор CVSS 3.1 і бал
- `cwe` + категорія OWASP Top 10 (2021)
- `location` — `файл:рядок`
- `origin` — code / config / dependency / process
- `component` — backend / prisma / frontend / cli / sdk-java / scripts / infra / ci
- `description`, `evidence`, `impact`, `recommendation`, `related`, `effort` (S/M/L), `confidence` (High/Medium/Low)

Severity — для моделі розгортання: внутрішній сервіс, дані — екрани банківських застосунків,
кілька команд в одному інстансі, сусідство з робочим VRT.

## Етап 3 — Звіт

Структура (українською): титул (коміт, дата, скоуп, «Конфіденційно»); резюме для керівництва
(рівень ризику, кількість за severity, що змінилось, топ-5, вердикт готовності); скоуп/методологія/
інструменти/обмеження; архітектура й модель загроз (діаграма); регресія S-1…S-15; зведена таблиця;
детальні знахідки за severity; дані за межами контуру й LLM; комерційне використання; roadmap
(до перенесення / 30 / 90 днів); додатки (сканери з розбором FP, SBOM, ліцензії, перевірені області).

PDF: `report.md` → HTML з CSS → WeasyPrint; шрифт з кирилицею (`@font-face`); бейджі severity,
нумерація, зміст, таблиці без обрізання; Mermaid → SVG/PNG через `@mermaid-js/mermaid-cli`
(Chromium `/opt/pw-browsers/chromium`); перевірка кожної сторінки в PNG; звірка кількості знахідок.

Артефакти в `audit/` (не комітити): `report.pdf`, `report.md`, `findings.json`, `threat-model.md`,
`sbom.cdx.json`, `raw/`, `PROGRESS.md`.

Наприкінці — коротке резюме: кількість за severity, що змінилось, вердикт, топ-3 до виправлення.

---

## Рішення власника, зафіксовані під час цього аудиту (2026-11-05)

- **Дистрибуція/ліцензії:** автор розробив Vision сам і передає його своїй компанії для
  внутрішнього використання, без продажу (не комерційна дистрибуція третій стороні).
- **Історія git:** не розглядати — її буде стерто при перенесенні; аудит лише поточного дерева.
- **Стенд:** нативний (демона Docker у середовищі аудиту немає; `trivy image` недоступний).
