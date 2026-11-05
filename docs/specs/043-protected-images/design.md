# 043 — Дизайн

## Підхід

**Підпис файла (REQ-043-03).** Чиста `file-links.ts`: підпис — HMAC-SHA256 імені файла ключем,
виведеним з `VISION_SECRET_KEY` (окремий домен, не той, що шифрує токени, 044), 128 біт у
base64url. Підпис залежить лише від імені й ключа, тож діє, доки є файл, і не підходить до
жодного іншого. Підпис для публічного звіту — HMAC `report`, токена звіту й імені:
`<токен>.<підпис>`, діє, доки чинне посилання на звіт (REQ-043-06).

**Хто отримує підписи (REQ-043-01).** Глобальний `FileLinksInterceptor` до кожної JSON-відповіді
маршруту з guard-ом (лише той, хто увійшов чи має API-ключ, і лише те, що йому вже віддали)
додає в кожен об'єкт з полями файлів (`imageName`, `diffName`, `baselineName`,
`imageThumbnailName`, `diffThumbnailName`) поле `fileSignatures: { <ім'я>: <підпис> }`. Сокет
подій робить те саме перед розсилкою в кімнату проєкту (ADR-0023). Маршрут без guard-а підписів
не отримує: публічний звіт підписує сам, підписом звіту. Наявні поля не змінюються, тож SDK і
CLI не помічають різниці (Gson ігнорує невідоме поле).

**Видача (REQ-043-02, 04, 05).** `GET /images/:name?sig=…` і `/images/:name/download?sig=…`:
лише ім'я без шляху й лише `.png`; без підпису чи з чужим — `404`, як і для відсутнього файла.
Байти віддає API, без перенаправлення на `/<ім'я>`: `Cache-Control: private, max-age=31536000,
immutable` і `Access-Control-Allow-Origin` лише для `APP_FRONTEND_URL`. `useStaticAssets` у
`main.ts` прибрано, `location /static/imageUploads/` в nginx інтерфейсу й том картинок у
контейнера `ui` — теж. UI-дерева й звіти доступності інтерфейс бере лише маршрутами API зі
входом, як і раніше.

**Інтерфейс (US-1, сценарій 2).** `staticService` запам'ятовує `fileSignatures` з кожної
відповіді (`handleResponse`) і з подій сокета; `getImage(name)` і `getImageDownloadUrl(name)`
дописують `?sig=`. Місця, що показують знімки, не змінюються. `REACT_APP_STATIC_URL` прибрано:
статичного хоста для картинок більше немає.

**Jira (REQ-043-07).** Знімки йдуть у баг вкладеннями, сервер читає файли сам — без змін.

## Компоненти

| Компонент | Шлях | Роль |
|---|---|---|
| `signFile`, `isFileSignature`, `signReportFile`, `withFileSignatures` | `backend/src/static/file-links.ts` | підписи |
| `FileLinksInterceptor` | `backend/src/static/file-links.interceptor.ts` | підписи у відповідях |
| `StaticController` | `backend/src/static/static.controller.ts` | видача за підписом |
| публічний звіт | `backend/src/reports/reports.controller.ts` | підписи звіту |
| сокет | `backend/src/shared/events/events.gateway.ts` | підписи в подіях |
| `staticService` | `frontend/src/services/static.service.ts`, `_helpers/service.helpers.ts`, `contexts/socket.context.tsx` | запам'ятати й дописати підпис |
| nginx, compose | `frontend/nginx/default.conf`, `docker-compose.demo.yml`, `backend/src/main.ts` | без прямої видачі |

## Дані

Без змін у базі.

## Ризики

| Ризик | Що робимо |
|---|---|
| Підпис посилання вічний | його отримує лише той, кому віддали сам рядок; зміна `VISION_SECRET_KEY` анулює всі |
| Великі списки прогонів | підпис — один HMAC на ім'я, обхід JSON лінійний; інтерфейс бере ті самі відповіді |
| Хтось додасть маршрут без guard-а з іменами файлів | підписів там не буде, знімки не відкриються: помилка видна одразу, витоку немає |

## Перевірка вимог

| Вимога | Перевірка |
|---|---|
| REQ-043-01 | `backend/src/static/file-links.interceptor.spec.ts › signs the files of an answer only for a guarded route` |
| REQ-043-02 | `backend/src/static/static.controller.spec.ts › answers not found without a valid signature` |
| REQ-043-03 | `backend/src/static/file-links.spec.ts › opens its own file only and needs the server key` |
| REQ-043-04 | `backend/src/static/static.controller.spec.ts › lets only the person's browser keep a file and only Vision read it` |
| REQ-043-05 | `scripts/tests/test_protected_images.py › test_serves_no_stored_file_past_the_checks` |
| REQ-043-06 | `backend/src/reports/reports.controller.spec.ts › signs the report's own screens while its link is valid` |
| REQ-043-07 | `backend/src/visual-bugs/visual-bugs.service.spec.ts › attaches the marked checkpoint and the plain baseline` |
