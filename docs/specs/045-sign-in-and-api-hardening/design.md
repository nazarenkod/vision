# 045 — Дизайн

## Підхід

**Вхід разом (REQ-045-01).** `UsersService.login` з увімкненим LDAP спершу питає каталог: є
людина в каталозі — вирішує каталог, як і раніше. Немає її там — перевіряється локальний пароль
(`DbUsersService`). З увімкненим SSO форма входу паролем працює для локальних акаунтів, а кнопка SSO
стоїть над нею. Акаунти з каталогу й SSO мають пароль, якого ніхто не знає, тож локальний вхід їм
не відкривається. Адмін створює локальні акаунти в будь-якому режимі: `canCreateAccounts` завжди
`true`, що заміняє рішення 035 про неактивну кнопку New user. Автоперехід на SSO (`REACT_APP_OIDC_AUTO_REDIRECT`) не діє на
`/login?local`, звідки локальний акаунт входить паролем.

**Перебір (REQ-045-03).** Чиста `sign-in-limit.ts`: невдалі спроби в пам'яті процесу, за email
без регістру. 5 невдач за 15 хвилин — 15 хвилин `429` «Too many attempts: try again in 15
minutes», навіть із правильним паролем. Неіснуючий email рахується так само. Успіх скидає лічильник.
Ключі API (SDK, CLI) сюди не потрапляють. Vision працює одним процесом API, тож пам'яті досить:
після перезапуску відлік починається знову.

**Пароль (REQ-045-04).** `passwordProblem(password)` — щонайменше 12 символів. Перевіряють
створення акаунта, зміна свого пароля й пароль від адміна. Вхід не перевіряє: наявний короткий
пароль працює. Інтерфейс підказує правило в полях пароля.

**Помилки (REQ-045-05).** `HttpExceptionFilter` відповідає `{ statusCode, message, path }`, а для
409 налаштувань ще `fields`. Для помилки, що не є `HttpException`, — лише «Internal server error».
Подробиці пишуться в лог сервера.

**API назовні (REQ-045-06…08).** Чиста `security.ts`:
- `corsOriginOf(env)` — лише origin `APP_FRONTEND_URL`, без нього CORS немає;
- `swaggerEnabled(env)` — `VISION_SWAGGER=true`;
- `securityHeaders` — middleware: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy: no-referrer`, `Cross-Origin-Opener-Policy: same-origin`.

nginx інтерфейсу ставить ті самі заголовки. Нової залежності (helmet) не треба.

**Розгортання (REQ-045-02).** `docker-compose.demo.yml` передає в API кожен `LDAP_*` і `OIDC_*` з
`backend/.env.example`, а також `VISION_SWAGGER`.

## Компоненти

| Компонент | Шлях | Роль |
|---|---|---|
| `SignInLimit` | `backend/src/users/sign-in-limit.ts` | спроби входу |
| `passwordProblem` | `backend/src/users/account.ts` | довжина пароля |
| вхід | `backend/src/users/users.service.ts` | каталог, потім локально; ліміт |
| `HttpExceptionFilter` | `backend/src/http-exception.filter.ts` | відповідь на помилку |
| `corsOriginOf`, `swaggerEnabled`, `securityHeaders` | `backend/src/security.ts`, `main.ts` | API назовні |
| вхід в інтерфейсі | `frontend/src/components/LoginForm.tsx` | SSO і пароль разом |
| nginx, compose | `frontend/nginx/default.conf`, `docker-compose.demo.yml` | заголовки, налаштування |

## Дані

Без змін.

## Ризики

| Ризик | Що робимо |
|---|---|
| Хтось заблокує чужий email навмисно | лише на 15 хвилин; SDK і CLI ходять ключем і далі працюють |
| Людина з каталогу мала локальний пароль з VRT | каталог вирішує першим: поки вона в каталозі, пароль з VRT не діє |
| Інтеграція читала `stack` чи `exception` з помилки | інтерфейс читав лише `message`; так і лишається |

## Перевірка вимог

| Вимога | Перевірка |
|---|---|
| REQ-045-01 | `backend/src/users/users.service.spec.ts › signs in a local account beside LDAP and SSO`; `frontend/integration_tests/test/login.spec.ts › offers SSO and the local sign-in together` |
| REQ-045-02 | `scripts/tests/test_api_hardening.py › test_passes_every_ldap_and_sso_setting_to_the_api` |
| REQ-045-03 | `backend/src/users/sign-in-limit.spec.ts › refuses an email for 15 minutes after 5 failed attempts` |
| REQ-045-04 | `backend/src/users/users.service.spec.ts › takes a local password of 12 characters or more only` |
| REQ-045-05 | `backend/src/http-exception.filter.spec.ts › answers an error with its code, message and path only` |
| REQ-045-06 | `backend/src/security.spec.ts › answers browsers of Vision's own interface only` |
| REQ-045-07 | `backend/src/security.spec.ts › keeps the API documentation off until it is turned on` |
| REQ-045-08 | `backend/src/security.spec.ts › sends the standard security headers`; `scripts/tests/test_api_hardening.py › test_the_interface_sends_the_same_headers` |
