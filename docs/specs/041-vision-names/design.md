# 041 — Дизайн

## Підхід

Заміна назв без нової логіки. Тексти інтерфейсу — у словниках `en.ts` і `uk.ts`
([ADR-0017](../../decisions/0017-interface-in-two-languages.md)); перший крок туру входу тепер
каже, звідки береться акаунт, і не показує жодного. Приклад налаштувань SDK у профілі — під SDK
1.0.0 ([040](../040-uitree-limits-and-sdk-names/spec.md)). Значення за замовчуванням змінюються в
коді й прикладах; наявні `.env.demo` і бази працюють як задано. Решта ребрендингу без зміни
поведінки (назви пакетів, README, `NOTICE`, прибрані workflow вихідного проєкту) — у
[ADR-0027](../../decisions/0027-vision-own-product.md).

## Компоненти

| Компонент | Шлях | Роль |
|---|---|---|
| тур входу | `frontend/src/i18n/en.ts`, `uk.ts` (`tour.loginAdmin`) | текст без акаунта |
| профіль | `frontend/src/pages/ProfilePage.tsx`, `profile.configHelp` | `VISION_*`, `vision.json` |
| архів | `frontend/src/services/static.service.ts` | `vision_images.zip` |
| версія | `frontend/src/components/SideNav.tsx`, `_config/env.config.ts`, `env.defaults` | `VISION_VERSION` |
| документація API | `backend/src/swagger.ts` | назва «Vision» |
| перший адмін | `backend/prisma/seed.ts`, `docker-compose.demo.yml`, `backend/.env.example` | `admin@vision.local` |
| групи адмінів SSO | `backend/src/users/oidc/oidcusers.service.ts` | `vision-admin,admin` |
| значення за замовчуванням | `package.json`, `docker-compose.demo.yml`, `.env.demo.example`, `scripts/*` | `vision` |

## Дані

Без змін у схемі. Назва бази за замовчуванням — `vision`; наявна інсталяція тримає свою з
`.env.demo`.

## Ризики

| Ризик | Що робимо |
|---|---|
| SSO покладається на типову групу `vrt-admin` | compose ще не передає `OIDC_*` в API (лише `OIDC_ENABLED`); передачу налаштувань входу додає план 2.5, тоді ж — явні групи |
| Скриншот-еталони з текстами туру й версією | перезнімаються в Docker з цією зміною |

## Перевірка вимог

| Вимога | Перевірка |
|---|---|
| REQ-041-01 | `frontend/src/constants/help.test.ts › names no account and no password in the login tour` |
| REQ-041-02 | `frontend/integration_tests/test/profile.spec.ts › shows a new API key once and only its ending later` |
| REQ-041-03 | `frontend/src/services/static.service.test.ts › saves the chosen images as vision_images.zip` |
| REQ-041-04 | `frontend/integration_tests/test/guidedTour.spec.ts › shows the Vision version in the help menu` |
| REQ-041-05 | `backend/src/swagger.spec.ts › names the API documentation Vision` |
| REQ-041-06 | `backend/prisma/test/seed.spec.ts › creates admin@vision.local when no admin email is set` |
| REQ-041-07 | `backend/src/users/oidc/oidcusers.service.spec.ts › creates a new user and derives the admin role from the claims` |
| REQ-041-08 | `scripts/tests/test_vision_names.py › test_defaults_and_examples_name_no_vrt` |
