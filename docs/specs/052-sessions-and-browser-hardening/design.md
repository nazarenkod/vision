# 052 — Дизайн

## Підхід

Чотири частини, кожна — чиста функція з тестом і мінімальні правки там, де її викликають. Як і для
051: спершу тести на поточну поведінку (вхід, сокет, SSO, заголовки, ролі), потім зміна, і ті самі
тести лишаються зеленими (REQ-052-14).

- **Входи в базі (US-1, US-2).** Кожен вхід (пароль, LDAP, SSO) створює рядок `Session` і кладе
  його `id` у токен як `sid`.
  - **Перевірка.** `JwtStrategy` і рукостискання сокета перевіряють сесію однією чистою функцією
    `sessionProblem(payload, session, user)`. Сесії немає, вона завершена, або токен старший за
    `User.tokensValidAfter` — «не авторизовано».
  - **Токени, видані до оновлення,** не мають `sid`. Вони діють, доки людина не вийде чи не змінить
    пароль: тоді `tokensValidAfter` гасить їх (REQ-052-14).
  - **Вихід** (`POST /users/logout`) завершує лише сесію з токена (REQ-052-01).
  - **Зміна пароля самою людиною** завершує всі інші її сесії. Поточна лишається, тож браузер не
    отримує нового токена (REQ-052-02).
  - **Пароль від адміна** завершує всі сесії (REQ-052-03).
  - **Видалення акаунта** видаляє його сесії каскадом (REQ-052-04).
  - **Чому сесії в базі, а не в пам'яті.** Кілька процесів API бачать те саме відкликання
    (граничний випадок). Окрім того, з таблиці потім можна показати людині її активні сесії.
- **Сокет подій.** `EventsGateway` пам'ятає в `socket.data` `userId` і `sessionId`.
  - **Завершення.** Після виходу, зміни пароля чи видалення сервіс викликає
    `gateway.endSessions({ userId, keep?, only? })`. Той закриває відповідні сокети через
    `fetchSockets()`, що працює й через адаптер Redis (REQ-052-04).
  - **Зміна ролі.** `gateway.recheckAccess(userId)` наново перевіряє кожну кімнату проєкту тим
    самим правилом, що й `subscribe`, і виходить з тих, де доступу більше немає (REQ-052-06).
- **SSO лише у своєму браузері (US-3).**
  - **Початок.** Інтерфейс перед переходом на `/users/oidc/login` кладе випадкове значення
    `nonce` у `sessionStorage` і передає його в адресі.
  - **Повернення.** API зберігає `nonce` у вже наявній cookie стану (поряд зі `state` і PKCE) і
    повертає його у фрагменті разом із токеном.
  - **Перевірка.** `LoginPage` приймає токен, лише якщо `nonce` збігається з тим, що в
    `sessionStorage` цієї вкладки. Інакше прибирає фрагмент і показує сторінку входу (REQ-052-07).
  - **Чому так.** Чуже посилання не знає `sessionStorage` жертви. Для цього не потрібні ні CORS,
    ні нові cookie.
- **CSP і HSTS (US-4).**
  - **Одне джерело політики.** Політику інтерфейсу описує шаблон `frontend/nginx/csp.template` з
    `${API_ORIGIN}` і `${API_WS_ORIGIN}`. При старті контейнера `env.sh` підставляє адресу API з
    `REACT_APP_API_URL` і пише заголовок у файл, який nginx включає в `server`. Той самий шаблон
    читає `vite.config.ts` для `preview.headers`, тож Playwright ганяє весь інтерфейс під тією
    самою політикою (REQ-052-11).
  - **Вбудований скрипт** (`window.global = window` в `index.html`) переїжджає у файл.
  - **API** відповідає з `default-src 'none'; frame-ancestors 'none'`. Swagger, коли увімкнений,
    отримує політику, з якою він працює.
  - **HSTS** надсилається лише на запит по https: `req.secure` або `X-Forwarded-Proto: https`.
    Для nginx — `$scheme` або той самий заголовок, через `map`. По http — ні (REQ-052-09, 10).
- **Ролі SSO (US-5).** `oidcusers.service` при вході:
  - є група адмінів — `admin`;
  - групи немає, а людина зараз `admin` — типова роль;
  - інакше роль лишається тією, що в базі (REQ-052-12).

  Перший вхід — як раніше.

## Компоненти

| Компонент | Шлях | Роль |
|---|---|---|
| Сесії | `backend/prisma/schema.prisma`, `backend/prisma/migrations/<…>_add_sessions/` | таблиця `Session`, `User.tokensValidAfter` |
| Перевірка сесії | `backend/src/auth/sessions.ts` | `sessionProblem`, `newSession`, `endSessions` (чисті функції + Prisma) |
| Видача токена | `backend/src/auth/auth.service.ts` | `signToken` створює сесію, кладе `sid` |
| Перевірка в API | `backend/src/auth/jwt.strategy.ts` | відмова для завершеної сесії |
| Вихід, паролі, видалення, роль | `backend/src/users/users.controller.ts`, `users.service.ts` | `POST /users/logout`, відкликання, виклики сокета |
| Сокет | `backend/src/shared/events/events.gateway.ts` | перевірка сесії при рукостисканні, `endSessions`, `recheckAccess` |
| SSO | `backend/src/users/users.controller.ts`, `oidc/oidcusers.service.ts`; `frontend/src/services/users.service.ts`, `pages/LoginPage.tsx` | `nonce`; ролі при вході |
| Вихід в інтерфейсі | `frontend/src/services/users.service.ts`, `contexts/user.context.tsx` | запит на вихід перед очищенням |
| CSP і HSTS в API | `backend/src/security.ts` | заголовки |
| CSP і HSTS в nginx | `frontend/nginx/default.conf`, `frontend/nginx/csp.template`, `frontend/env.sh`, `frontend/index.html`, `frontend/public/global-polyfill.js` | політика при старті контейнера |
| Тести під CSP | `frontend/vite.config.ts`, `frontend/integration_tests/fixtures/index.ts` | та сама політика в Playwright, тест падає на порушенні |

## Дані

Лише додавальні зміни ([ADR-0003](../../decisions/0003-additive-schema-only.md)):

- **Нова таблиця `Session`:** `id`, `userId` (каскадне видалення з `User`), `createdAt`,
  `expiresAt`, `endedAt` (nullable), індекс за `userId`.
- **Нова nullable-колонка `User.tokensValidAfter`.**

Старі дані не чіпаються. Сесії, що спливли, прибираються при вході тієї самої людини: рядків не
більше, ніж її входів за термін токена.

## Ризики

| Ризик | Що робимо |
|---|---|
| CSP блокує якийсь ресурс на екрані, якого тести не бачать | весь набір Playwright під тією самою політикою; тест падає на першому `securitypolicyviolation`; ручний обхід екранів на стенді |
| Ще одна вибірка з бази на кожен запит | вибірка за первинним ключем `Session.id`; e2e-тест на час відповіді |
| Токени, видані до оновлення | діють як раніше до виходу чи зміни пароля; тест на це |
| Вхід через SSO, почато в одній вкладці, а повернувся в іншу | `sessionStorage` вкладки: провайдер повертає в ту саму вкладку; інакше людина входить ще раз (граничний випадок у специфікації) |
| `X-Forwarded-Proto` підробляє клієнт | наслідок — HSTS у відповіді по http, який браузер ігнорує; шкоди немає |

## Перевірка вимог

| Вимога | Перевірка |
|---|---|
| REQ-052-01 | `backend/test/sessions.e2e-spec.ts › signing out ends this browser only` |
| REQ-052-02 | `backend/test/sessions.e2e-spec.ts › a new password ends the other sign-ins and keeps this one` |
| REQ-052-03 | `backend/test/sessions.e2e-spec.ts › a password set by an admin ends every sign-in` |
| REQ-052-04 | `backend/test/sessions.e2e-spec.ts › closes the event sockets of an ended sign-in and a deleted account` |
| REQ-052-05 | `backend/test/sessions.e2e-spec.ts › the API key works whatever the person does with their sign-ins` |
| REQ-052-06 | `backend/test/sessions.e2e-spec.ts › stops the events of a project after a new role takes it away` |
| REQ-052-07 | `frontend/integration_tests/test/login.spec.ts › does not sign in from a link the browser did not start`; `backend/src/users/users.controller.spec.ts › hands the nonce of the sign-in back with the token` |
| REQ-052-08 | `backend/src/security.spec.ts › answers with a content security policy`; `scripts/tests/test_api_hardening.py › test_ui_has_the_content_security_policy` |
| REQ-052-09 | `backend/src/security.spec.ts › asks for https only on a request that came over https` |
| REQ-052-10 | `backend/src/security.spec.ts › sends no HSTS over http`; `scripts/tests/test_api_hardening.py › test_ui_sends_hsts_only_over_https` |
| REQ-052-11 | `frontend/integration_tests/fixtures/index.ts › fails a test on any content security policy violation` (увесь набір Playwright) |
| REQ-052-12 | `backend/src/users/oidc/oidcusers.service.spec.ts › keeps the role an admin gave when SSO names no admin group` |
| REQ-052-13 | `manual: знято рішенням власника — OIDC_ADMIN_VALUES типово vision-admin,admin, як і було` |
| REQ-052-14 | `backend/test/sessions.e2e-spec.ts › keeps working as before for people who stay signed in`; `backend/test/sessions.e2e-spec.ts › takes a token issued before the update until the person signs out` |
