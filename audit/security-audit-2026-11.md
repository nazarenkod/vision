# Vision — аудит безпеки й ліцензій

Листопад 2026. Два етапи: ручний аудит коду, конфігурації й залежностей (2026-11-04, коміт `5540f89`)
і автоматичний SAST після виправлень (2026-11-09, коміт `4ac0ca9`). Тут — що знайдено, як виправлено
і що лишається.

## Результат

| Перевірка | Інструмент | Стан |
|---|---|---|
| Ручний розбір коду й конфігурації | OWASP ASVS як орієнтир | 15 знахідок: 12 виправлено, 3 низькі прийнято |
| SAST: TypeScript/React, Java, Python, Dockerfile, bash | semgrep 1.184.0 (1081 правило), bandit 1.9.4, shellcheck 0.11.0 | 0 підтверджених; 2 знайдені виправлено |
| Секрети в коді | detect-secrets, semgrep secrets | 0 |
| Вразливості залежностей, prod і dev | `npm audit` | 0 у `backend`, `backend/prisma`, `frontend` |
| Ліцензії залежностей поставки | license-checker | лише пермісивні, copyleft немає |
| Компоненти без підтримки | ручна перевірка | немає: Node 24.22.2, nginx-unprivileged 1.30.6, Postgres 16 |

**Статус: пройдено.**

## Обсяг і методи

- **Код:** автентифікація, ролі на кожному ендпоінті, вхідні дані (XML, gzip, файли), вихідні
  з'єднання, зберігання секретів; пошук відомих форматів токенів і ключів.
- **Інфраструктура:** Dockerfile, docker compose, nginx, скрипти розгортання, CI.
- **Залежності:** усі пакети трьох `package-lock.json` і `sdk-java/build.gradle`; `npm audit`
  окремо для prod і dev.
- **SAST:** `backend/`, `frontend/`, `sdk-java/`, `scripts/`, Dockerfile-и, nginx.

Не покрито: пакети ОС усередині Docker-образів (потрібен сканер образів, наприклад Trivy або
Grype), транзитивні залежності Gradle, пентест.

## Знахідки й стан

| # | Рівень | Знахідка | Стан |
|---|---|---|---|
| S-1 | високий | `fast-xml-parser` 4.5 з critical-CVE (розгортання сутностей) і `gunzipSync` без ліміту: один запит з API-ключем кладе сервер | виправлено: парсер ≥ 5.12 без сутностей, ліміт розпакованого дерева 10 МиБ і тіла запиту, той самий ліміт у SDK ([040](../docs/specs/040-uitree-limits-and-sdk-names/spec.md)) |
| S-2 | високий | editor міг змінити адресу Jira проєкту й отримати особисті токени колег | виправлено: Jira лише на хости з `VISION_JIRA_HOSTS`, лише `https`, без переадресацій ([044](../docs/specs/044-secrets-at-rest/spec.md)) |
| S-3 | високий | токени Jira і ключі Gemini в базі відкритим текстом | виправлено: AES-256-GCM ключем `VISION_SECRET_KEY`; API-ключі — лише SHA-256 ([044](../docs/specs/044-secrets-at-rest/spec.md)) |
| S-4 | середній | `.env` у git з відомими `JWT_SECRET`, паролем і API-ключем; застосунок з ними стартував | виправлено: `.env` прибрано з git; API не стартує без секретів, з короткими чи відомими; seed без відомого API-ключа ([051](../docs/specs/051-security-quick-fixes/spec.md)) |
| S-5 | середній | знімки й UI-дерева віддавались без входу, з `Access-Control-Allow-Origin: *` і публічним кешем | виправлено: лише за HMAC-підписом, без статики в API і nginx, `Cache-Control: private` ([043](../docs/specs/043-protected-images/spec.md)) |
| S-6 | середній | немає захисту від перебору паролів, будь-який непорожній пароль | виправлено: 5 спроб за 15 хв, пароль ≥ 12 символів ([045](../docs/specs/045-sign-in-and-api-hardening/spec.md)) |
| S-7 | середній | CORS для будь-якого джерела, немає заголовків безпеки, Swagger відкритий | виправлено: CORS лише для свого інтерфейсу, CSP, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, HSTS, `server_tokens off`, Swagger за прапорцем ([045](../docs/specs/045-sign-in-and-api-hardening/spec.md), [052](../docs/specs/052-sessions-and-browser-hardening/spec.md)) |
| S-8 | середній | контейнери від root, перевірку TLS вимкнено під час збирання й в образі міграцій | виправлено: `USER` в усіх образах, TLS перевіряється, CA проксі — через `NODE_EXTRA_CA_CERTS`, базові образи за digest |
| S-9 | середній | Postgres опубліковано на всіх інтерфейсах хоста | виправлено: порт не публікується |
| S-10 | низький | кореневий compose брав чужі образи з Docker Hub, інсталятор качав `.env` без перевірки | виправлено: лише образи, зібрані з цього коду; інсталятор прибрано |
| S-11 | низький | немає ізоляції проєктів: кожен бачить усі | виправлено: доступ до проєктів, чужий проєкт — `404`, і для API-ключів, і для подій ([042](../docs/specs/042-project-access/spec.md)) |
| S-12 | низький | OIDC і LDAP мають опцію вимкнути перевірку TLS | прийнято: типово `false`, лише для тестових стендів |
| S-13 | низький | сеанс (JWT) у `localStorage`: XSS забрав би його | прийнято: CSP без inline-скриптів, у коді немає XSS-синків, «Вийти» анулює токен на сервері ([052](../docs/specs/052-sessions-and-browser-hardening/spec.md)); httpOnly-кука відкладена |
| S-14 | низький | bcrypt з cost 10 (рекомендовано 12) | прийнято |
| S-15 | середній | помилки API віддавали stack trace з шляхами сервера й увесь об'єкт винятку | виправлено: лише `statusCode`, `message`, `path`; stack — лише в лог ([045](../docs/specs/045-sign-in-and-api-hardening/spec.md)) |

Знайдено SAST-ом і виправлено:

| Проблема | CWE | Файл | Тест |
|---|---|---|---|
| AES-GCM приймав укорочений тег автентифікації | CWE-326 | `backend/src/shared/secret-box.ts` | `secret-box.spec.ts` |
| `$&`, `` $` ``, `$'` в email змінювали фільтр LDAP | CWE-90 | `backend/src/users/ldap/ldapusers.service.ts` | `ldapusers.service.spec.ts` |

Що перевірено й гаразд: ролі на всіх змінювальних ендпоінтах; бекапи — лише admin; відкликати
посилання на звіт може лише автор або admin; токени публічних звітів — 256 біт; фільтр LDAP
екранується (RFC 4515); завантаження файлів відсікає шляхи; у frontend немає
`dangerouslySetInnerHTML` і `eval`; `UpdateUserDto` не дає змінити роль; CLI — стандартна
бібліотека Python з перевіркою TLS; шрифти локальні.

## Пробний прогін під Fortify (2026-11-19)

Перед скануванням у банку (Fortify SAST) — semgrep 1.186 з правилами спільноти, bandit 1.9.4,
`npm audit --omit=dev` і ручний пошук категорій, які Fortify ловить, а semgrep ні. Справжніх
вразливостей 0, `npm audit` — 0 у всіх пакетах. Що Fortify, найімовірніше, позначив би, і стан:

| Категорія Fortify | Місце | Стан |
|---|---|---|
| Password Management: Hardcoded Password | пароль першого адміністратора `123456` за замовчуванням (seed, compose) | виправлено: пароля за замовчуванням немає, ≥ 12 символів, інакше міграція зупиняється ([082](../docs/specs/082-fortify-readiness/spec.md)) |
| Privacy Violation | seed друкував пароль адміністратора й рядки проєктів | виправлено: лише email і кількість ([082](../docs/specs/082-fortify-readiness/spec.md)) |
| Weak Cryptographic Hash | SHA-1 у кодах проблем, ID груп, відбитках областей, ETag | виправлено: SHA-256; збережені коди не змінюються ([082](../docs/specs/082-fortify-readiness/spec.md)) |
| Poor Error Handling: Empty Catch Block | `MixedGuard`, CLI (`except: pass`) | виправлено ([082](../docs/specs/082-fortify-readiness/spec.md)); запобіжник `scripts/tests/test_scanner_findings.py` |
| Insecure SSL: Server Identity Verification Disabled | `OIDC_TLS_NO_VERIFY`, `LDAP_TLS_NO_VERIFY` (S-12) | рішення власника |
| Path Manipulation | `hdd.service.ts`, `backups.service.ts` | Not an Issue: вихід за каталог відсікається, імена файлів бекапу задані в коді |
| Open Redirect | `users.controller.ts` (OIDC), `static.controller.ts` | Not an Issue: адресу будує сервер з налаштувань, не з запиту |
| Log Forging / Privacy Violation | email у логах OIDC і LDAP | Low: email без пароля й токенів; за потреби — маскувати |
| HTML5: Local Storage | сеанс у `localStorage` (S-13) | прийнято, див. вище |
| Hardcoded Password у тестах | фікстури `*.spec.ts`, `integration_tests` | якщо банк сканує тести — виключити їх зі сканування або позначити Not an Issue |

## Хибні спрацювання SAST

semgrep дав 1311 спрацювань (ERROR 4, WARNING 1179, INFO 128), підтверджених — 0. Із них 1020 —
`i18next-key-format` (формат ключів словника, не безпека), 65 — тестовий код поза поставкою.

| Правило | Місце | Чому хибне |
|---|---|---|
| `useless-ternary` | `backend/src/backups/backups.service.ts` | `secret ? 0o600 : 0o644` — різні значення |
| `dangerous-subprocess-use-audit` | `frontend/public/cli/vision.py` | аргументи списком, без shell |
| `dangerous-subprocess-use-audit` | `scripts/seed-insights-demo.py` | команда задана в коді, без shell |
| `dangerous-subprocess-use-audit` | `scripts/verify.py` | команда задана в коді, без shell |

## Залежності

На момент ручного аудиту prod-залежності backend мали 1 critical, 7 high і 6 moderate, frontend —
3 low. Виправлено мажорними оновленнями: NestJS 12, Prisma 7, свіжі `@nestjs/swagger`, `rimraf`,
`ldapts`; `uuid-apikey` замінено на `crypto.randomUUID`; `react-joyride` 3; eslint 9, jest 30.
Після оновлень `npm audit` — 0 у prod і dev усіх пакетів.

Компоненти без підтримки замінено: Node 20 → 24 LTS, nginx 1.25 → nginx-unprivileged 1.30 (stable),
PostgreSQL 12 → 16; стек ELK 7.14 (log4j 2.11) прибрано.

## Ліцензії

Vision — Apache-2.0, похідна робота від Visual Regression Tracker; атрибуція — у [NOTICE](../NOTICE).

Залежності поставки — лише пермісивні: MIT, Apache-2.0, ISC, BSD-2/3, 0BSD, BlueOak-1.0.0, PSF-2.0,
OFL-1.1 (шрифти). `jszip` (MIT OR GPL-3.0) використовується за MIT. EPL-2.0 `elkjs` (частина Prisma
Studio) видаляється під час збирання образів. MPL-2.0 і CC-BY-4.0 є лише серед dev-залежностей.
Повний перелік — [сторонні компоненти](../docs/security/third-party-licenses.md).

Прибрано з репозиторію: ELK (Elastic License / SSPL), туторіали й скриншоти чужих сайтів (тестові
картинки — синтетичні), зібраний jar SDK (збирається з вихідного коду, `scripts/build-sdk-jar.sh`).

## Вихідні з'єднання

| Куди | Коли | Що йде | Як обмежено |
|---|---|---|---|
| Jira | заведення багів, пошук дублів | баги, вкладення, особистий токен | лише хости з `VISION_JIRA_HOSTS` |
| LDAP / OIDC | вхід | облікові дані | лише якщо увімкнено |
| Gemini | лише на вимогу людини | знімок, UI-дерево, тексти | типово вимкнено (`AI_PROVIDER=none`) |
| Ollama | лише на вимогу людини | знімок | локальний сервер |
| Сховище бекапів (rclone) | щоночі | бекап без паролів і токенів | лише якщо налаштовано |
| npm, Prisma, Docker Hub | лише збирання | — | дзеркала: `VISION_NPM_REGISTRY`, `VISION_PRISMA_ENGINES_MIRROR`; телеметрія вимкнена (`CHECKPOINT_DISABLE=1`, `SCARF_ANALYTICS=false`) |

## Що лишається

- Сканування Docker-образів (пакети ОС) і пентест.
- Прийняті низькі ризики S-12, S-13, S-14 (див. таблицю).
- Бекапи не шифруються самим Vision: шифрування — на боці сховища.
