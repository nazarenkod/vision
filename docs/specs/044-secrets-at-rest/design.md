# 044 — Дизайн

## Підхід

**Шифрування (REQ-044-01…03).** Чиста `secret-box.ts`: AES-256-GCM, ключ — SHA-256 від
`VISION_SECRET_KEY`; значення в базі — `enc:v1:<iv>:<tag>:<шифр>` (base64url). Шифруються особисті
`User.jiraToken`, `User.geminiApiKey` і ключ Gemini проєкту в `Project.imageComparisonConfig`
(поле `apiKey` у JSON). Розшифровуються лише там, де секрет іде в Jira чи Gemini: `jiraAccess`,
`AiFeaturesService` (особистий ключ), `CompareService` (ключ проєкту для VLM). Без
`VISION_SECRET_KEY` API не стартує (`main.ts`, до створення застосунку) і пише, що задати.

**API-ключі (REQ-044-04…06).** У колонці `User.apiKey` — `sha256:<hex>` ключа: ключі випадкові
(140 біт), тож повільний хеш не потрібен, а пошук за унікальним індексом лишається одним
запитом. Нова nullable-колонка `apiKeyEnding` — останні 4 символи, для впізнавання. Guard-и
хешують заголовок `apiKey` перед пошуком. `GET /users/newApiKey` повертає ключ один раз; `UserDto`
віддає лише `apiKeyEnding`. Seed (образ міграцій) і `vision-restore.sh` пишуть хеш.

**Перший старт (REQ-044-02, 06).** `SecretsAtRestService.onModuleInit`: відкриті токени й ключі
Gemini — зашифрувати; кожен `apiKey` без префікса `sha256:` (скопійований з VRT чи старої
версії) — замінити хешем випадкового ключа, якого ніхто не знає, і стерти `apiKeyEnding`. За
форматом значень повторний старт нічого не змінює; нова копія з VRT знову анулюється.

**Jira (REQ-044-07…09).** `jira-hosts.ts`: `VISION_JIRA_HOSTS` — імена хостів через кому.
Збереження проєкту з `jiraUrl` поза списком (або коли список порожній) — 400 з переліком;
`jiraAccess` перевіряє перед кожним зверненням і не створює клієнта з токеном.

**Інтерфейс (REQ-044-05).** Картка API-ключа показує `•••• ABCD` і кнопку «Новий ключ»; новий
ключ — один раз, з копіюванням і попередженням; приклади налаштувань і команда CLI — з ним, поки
він на екрані, інакше `YOUR_API_KEY`. Це заміняє показ ключа за кліком Show з [018](../018-ui-redesign/spec.md).

## Компоненти

| Компонент | Шлях | Роль |
|---|---|---|
| `encryptSecret`, `decryptSecret`, `isEncrypted`, `secretKeyFrom` | `backend/src/shared/secret-box.ts` | шифрування |
| `hashApiKey`, `isHashedApiKey` | `backend/src/shared/api-key-hash.ts` | хеш ключа |
| `SecretsAtRestService` | `backend/src/shared/secrets-at-rest.service.ts` | перший старт |
| `allowedJiraHosts`, `isAllowedJiraUrl` | `backend/src/a11y/jira-hosts.ts` | дозволені хости |
| guard-и | `backend/src/auth/guards/api.guard.ts`, `role.guard.ts` | пошук за хешем |
| користувачі | `backend/src/users/*.ts` | запис хеша й шифру, `UserDto.apiKeyEnding` |
| картка ключа | `frontend/src/components/ApiKeyCard.tsx`, `pages/ProfilePage.tsx`, `ManualChecksDialog.tsx` | новий ключ один раз |
| seed, відновлення, бекап | `backend/prisma/seed.ts`, `scripts/vision-restore.sh`, `scripts/lib/vision-backup.sh` | хеш; Gemini не в бекапі |

## Дані

Нова nullable-колонка `User.apiKeyEnding` (міграція `20261105120000_add_user_api_key_ending`,
ADR-0003). Решта — нові формати значень у наявних колонках.

## Ризики

| Ризик | Що робимо |
|---|---|
| Втрачено `VISION_SECRET_KEY` | токени перестають розшифровуватись; люди вводять заново, `jiraTokenSet` чесно каже «не задано» |
| Інтеграції, що читали `apiKey` з `/users/me` | ключ видно лише при створенні; CLI й SDK беруть його з налаштувань |
| Бекап мав ключі Gemini (ADR-0012) | `User.geminiApiKey` додано до затертих колонок |

## Перевірка вимог

| Вимога | Перевірка |
|---|---|
| REQ-044-01 | `backend/src/shared/secret-box.spec.ts › keeps no secret readable in what it stores` |
| REQ-044-02 | `backend/src/shared/secrets-at-rest.service.spec.ts › encrypts the plain Jira tokens and Gemini keys once` |
| REQ-044-03 | `backend/src/shared/secret-box.spec.ts › refuses to start without VISION_SECRET_KEY` |
| REQ-044-04 | `backend/src/shared/api-key-hash.spec.ts › finds a key by its hash and cannot get it back` |
| REQ-044-05 | `frontend/integration_tests/test/profile.spec.ts › shows a new API key once and only its ending later` |
| REQ-044-06 | `backend/src/shared/secrets-at-rest.service.spec.ts › makes every plain API key useless once` |
| REQ-044-07 | `backend/src/a11y/jira-hosts.spec.ts › takes a Jira address on an allowed host only` |
| REQ-044-08 | `backend/src/a11y/jira-access.spec.ts › sends the token to an allowed Jira only` |
| REQ-044-09 | `backend/src/a11y/jira-access.spec.ts › calls no Jira while no host is allowed` |
