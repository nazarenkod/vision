# Налаштування: довідник змінних

Усі налаштування Vision — у файлі `.env.demo` у корені (шаблон — [`.env.demo.example`](../../.env.demo.example)).
`./scripts/vision.sh` передає їх у `docker-compose.demo.yml`, а той — у контейнери. Читати, коли
ставите Vision уперше або змінюєте налаштування; як застосувати зміни — у [експлуатації](operations.md#зміна-налаштувань).

`.env.demo` містить секрети: права `600`, власник — користувач, від якого працює Vision; у git
його немає (`.gitignore`).

## Задати до першого запуску

Без `JWT_SECRET` і `VISION_SECRET_KEY` або з небезпечним значенням API не стартує й пише в лог,
чого бракує. Решта має робочі типові значення, але для робочої установки їх треба змінити.

| Змінна | Що | Вимоги |
|---|---|---|
| `JWT_SECRET` | підпис сеансів входу | випадковий, ≥ 32 символів (`openssl rand -base64 32`); не значення з прикладу, не таке, як `VISION_SECRET_KEY`, не секрет іншого сервісу. Зміна — усі входять заново |
| `VISION_SECRET_KEY` | шифрування токенів Jira і ключів Gemini (AES-256-GCM), підписи посилань на знімки | ті самі вимоги, що й до `JWT_SECRET`. **Зберігати назавжди** у сховищі секретів: новий ключ — усі вводять токени заново, старі посилання на знімки перестають діяти |
| `POSTGRES_PASSWORD` | пароль Postgres Vision | замінити `postgres` з прикладу. Postgres назовні не публікується. Береться лише при створенні порожньої бази: змінити його потім — `ALTER USER` у Postgres і нове значення тут |
| `DEMO_UI_URL` | адреса інтерфейсу, як її бачить браузер | наприклад `https://vision.example.com`; з неї — CORS і CSP |
| `DEMO_API_URL` | адреса API для браузера, SDK і CLI | наприклад `https://vision-api.example.com` |

## Перший адміністратор

Створюється міграцією, лише якщо в базі немає жодного активного адміністратора (порожня база).

| Змінна | Типово | Примітка |
|---|---|---|
| `DEFAULT_USER_EMAIL` | `admin@vision.local` | |
| `DEFAULT_USER_PASSWORD` | немає | **обов'язковий для порожньої бази**, щонайменше 12 символів: без нього міграція зупиняється й API не стартує; у лог пароль не виводиться ([082](../specs/082-fortify-readiness/spec.md)) |
| `DEFAULT_USER_API_KEY` | порожньо | порожньо — ключа немає, адмін створює його в профілі |

## Мережа й порти

| Змінна | Типово | Що |
|---|---|---|
| `DEMO_UI_PORT` | `18080` | порт інтерфейсу на хості (nginx у контейнері слухає 8080) |
| `DEMO_API_PORT` | `14200` | порт API на хості (Node у контейнері слухає 3000) |
| `VISION_EXTRA_CA_FILE` | порожньо | PEM з CA проксі, що переписує TLS: довіряють збирання і API (Jira, Gemini) |
| `VISION_NPM_REGISTRY` | порожньо | дзеркало `registry.npmjs.org` для збирання, наприклад Nexus |
| `VISION_PRISMA_ENGINES_MIRROR` | порожньо | дзеркало `binaries.prisma.sh` (рушій міграцій, завантажується під час збирання) |

## Вхід

Локальні акаунти працюють завжди; LDAP або SSO (OIDC) — одне з двох — поруч із ними.

| Змінна | Типово | Що |
|---|---|---|
| `JWT_LIFE_TIME` | `1d` | скільки діє вхід |
| `LDAP_ENABLED` | `false` | вхід через LDAP/AD |
| `LDAP_URL` | — | `ldaps://ldap.example.com:636/` |
| `LDAP_BIND_USER`, `LDAP_BIND_PASSWORD` | — | технічний обліковий запис для пошуку |
| `LDAP_SEARCH_DN` | — | де шукати людей |
| `LDAP_USERS_SEARCH_FILTER` | — | фільтр, `{{email}}` — те, що людина ввела |
| `LDAP_ATTRIBUTE_MAIL`, `…_FIRST_NAME`, `…_LAST_NAME` | `mail`, `givenName`, `sn` | атрибути каталогу |
| `OIDC_ENABLED` | `false` | вхід через SSO (Keycloak, ADFS, Entra ID…) |
| `OIDC_ISSUER_URL`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` | — | клієнт у провайдері |
| `OIDC_REDIRECT_URI` | `<DEMO_API_URL>/users/oidc/callback` | зареєструвати в провайдері |
| `OIDC_SCOPES` | `openid profile email` | |
| `OIDC_ATTRIBUTE_MAIL`, `…_FIRST_NAME`, `…_LAST_NAME` | `email`, `given_name`, `family_name` | claims профілю |
| `OIDC_ROLE_CLAIM` | `groups` | claim з групами |
| `OIDC_ADMIN_VALUES` | `vision-admin,admin` | групи, що дають роль `admin` |
| `OIDC_DEFAULT_ROLE` | `editor` | роль нового користувача SSO |
| `OIDC_REQUIRE_VERIFIED_EMAIL` | `true` | приймати лише підтверджений email |
| `REACT_APP_OIDC_AUTO_REDIRECT` | — | одразу на SSO; локальний вхід — `/login?local` |

Сертифікат сервера LDAP (`ldaps://`) і провайдера SSO перевіряється завжди. Підписаний внутрішнім
CA — дайте API цей CA у `VISION_EXTRA_CA_FILE` (PEM; кілька CA — одним файлом підряд).
`LDAP_TLS_NO_VERIFY` і `OIDC_TLS_NO_VERIFY` прибрано: задані, вони лише дають попередження в лозі
([082](../specs/082-fortify-readiness/spec.md)).

Пароль локального акаунта — від 12 символів; 5 невдалих спроб поспіль закривають вхід для цього
email на 15 хвилин ([045](../specs/045-sign-in-and-api-hardening/spec.md)).

## Інтеграції

| Змінна | Типово | Що |
|---|---|---|
| `VISION_JIRA_HOSTS` | порожньо | хости Jira, куди можна слати особисті токени, через кому; `https://host:порт` для нестандартного порту. Порожньо — Vision у Jira не ходить |
| `AI_PROVIDER` | `none` | `none`, `gemini` або `ollama`; викликається лише на вимогу людини ([ADR-0007](../decisions/0007-deterministic-first-ai-on-demand.md)) |
| `AI_MODEL` | — | модель провайдера |
| `GEMINI_API_KEY` | — | спільний ключ (особисті ключі люди вводять у профілі) |
| `OLLAMA_BASE_URL` | `http://host.docker.internal:11434` | локальний Ollama |
| `AI_DAILY_CALL_LIMIT` | `500` | денний ліміт викликів |
| `VISION_SWAGGER` | `false` | документація API за `<API>/api` |

> `AI_PROVIDER=gemini` означає, що знімки екранів ідуть до Google: якщо на них можуть бути
> дані клієнтів, вмикати лише з погодженням служби безпеки. `ollama` працює у вашій мережі.

## Ліміти й ресурси

| Змінна | Типово | Що |
|---|---|---|
| `BODY_PARSER_JSON_LIMIT` | `20mb` | розмір JSON-запиту |
| `VISION_MAX_SCREENSHOT_MB` | `50` | розмір знімка |
| `VISION_MAX_SCREENSHOT_PIXELS` | `40000000` | ширина × висота знімка |
| `DEMO_API_CPUS`, `DEMO_API_MEMORY` | `2`, `3g` | ліміти контейнера API |
| `DEMO_DIFF_WORKERS` | `2` | потоки порівняння знімків |
| `DEMO_POSTGRES_CPUS`, `DEMO_POSTGRES_MEMORY` | `1`, `1g` | ліміти Postgres |
| `DEMO_UI_CPUS`, `DEMO_UI_MEMORY` | `0.5`, `256m` | ліміти інтерфейсу |
| `VISION_DISK_RESERVE_GB` | 10 ГБ або 5 % диска | скільки диска має лишатися вільним після копіювання й збирання |

Ліміти потрібні, бо Vision стоїть на одній машині з робочим VRT. На окремому сервері їх можна
підняти, див. [вимоги](requirements.md#сервер).

## Копія даних робочого VRT

Лише для `scripts/demo-clone-from-prod.sh`; VRT лише читається ([ADR-0002](../decisions/0002-production-is-read-only.md)).

| Змінна | Що |
|---|---|
| `PROD_PG_CONTAINER` або `PROD_DATABASE_URL` | контейнер Postgres робочого VRT або рядок підключення |
| `PROD_DB_NAME` | назва бази VRT, якщо це не `POSTGRES_DB` контейнера |
| `PROD_IMAGES_DIR` | папка знімків робочого VRT |
| `PROD_IMAGES_MODE` | `copy` (типово) або `link` (жорсткі посилання, той самий диск) |

## Бекапи

| Змінна | Типово | Що |
|---|---|---|
| `VISION_MASTER_EMAIL`, `VISION_MASTER_PASSWORD` | — | вхід адміністратора після відновлення (у бекапах паролів немає); ≥ 12 символів; копія — поза сервером |
| `BACKUP_REMOTE` | порожньо | remote rclone і папка, наприклад `s3:vision-backups`; порожньо — лише локальні бекапи |
| `RCLONE_CONFIG_DIR` | `~/.config/rclone` | конфіг rclone |
| `BACKUP_KEEP` | `7` | скільки щоденних дампів тримати |

Замість Google Drive зі сторінки **Backups** можна використати внутрішнє S3-сумісне сховище через
`BACKUP_REMOTE` (див. [безпека](../security/overview.md#залишкові-ризики)).

## Службові

Задаються в compose, у `.env.demo` їх не змінюють: `DATABASE_URL`, `APP_FRONTEND_URL`,
`TASKS_CLEANUP_ENABLED=false`, `BACKUP_*_FILE/DIR`, `NODE_EXTRA_CA_CERTS`, `VISION_UID`/`VISION_GID`
(ставить `vision.sh`). `REDIS_URL` потрібен лише для кількох реплік API (адаптер socket.io); у
поставці одна репліка й Redis немає.
