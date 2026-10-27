# API Vision

Тут лише ендпоінти, які додав або змінив Vision. Повний перелік зі схемами дає Swagger API
(`/api`). Автентифікація: JWT користувача або API-ключ (`apiKey`), як в upstream. Дії, що
змінюють рішення, доступні ролям `admin` і `editor`.

## Прийом

| Метод і шлях | Що нового |
|---|---|
| `POST /test-runs`, `POST /test-runs/multipart` | необов'язкові `uiTree` (gzip + base64 XML; у multipart — файл), `uiTreeFormat` (`appium-android` / `appium-ios`), `deviceDensity` |

## Рев'ю знімка

| Метод і шлях | Призначення |
|---|---|
| `GET /test-runs/groups?buildId=` | групи змін збірки |
| `GET /test-runs/:id/structure` | зміни елементів, правила, шум |
| `POST /test-runs/:id/element-rules`, `…/element-rules/remove` | правило елемента для перевірки або проєкту |
| `GET /test-runs/:id/cross-device` | довідкове порівняння з еталонним пристроєм |
| `GET /test-runs/:id/a11y` | звіт доступності з рішеннями; заодно шукає в Jira незаведені проблеми (від імені того, хто дивиться) |

## Рішення щодо проблем доступності

Тіло завжди містить `violationId` (перша знахідка) і `violationIds` (усі знахідки однієї
проблеми). Відповідь — `{ problems?, warnings? }`, де `warnings` — те, що не вдалося в Jira (мітки).
Сама дія від цього не скасовується.

| Метод і шлях | Призначення |
|---|---|
| `POST /test-runs/:id/a11y/ignore` | false positive (`comment`) для проблеми на всіх екранах |
| `POST /test-runs/:id/a11y/reset` | забути рішення: Unlink або Restore. Знімає маркери Vision з бага й ставить `a11y-unlinked-<8 hex>`; якщо налаштування бачать лише частину проблеми — забуває лише цю частину |
| `POST /test-runs/:id/a11y/link` | прив'язати наявну задачу (`jiraKey`), поставити на неї маркери |
| `POST /test-runs/:id/a11y/jira/prepare` | що буде заведено під таскою (`parentKey`, `issueTypeId?`, `fieldValues?`): типи, поля, підсумок, маркери, `existing` (рішення у Vision), `inJira` (знайдені баги) |
| `GET /test-runs/:id/a11y/jira/users?query=` | пошук людей у Jira для полів-користувачів |
| `POST /test-runs/:id/a11y/jira` | завести баг (`parentKey`, `issueTypeId?`, `linkType?`, `fieldValues?`). Відповідь: `{ jiraKey, jiraUrl, code, alreadyFiled, warnings }`. `alreadyFiled: true` — нічого не створено, прив'язано наявний |

Помилки: `409` — проблему саме зараз заводить хтось інший або її позначено як false positive;
`400` — порушення немає в знімку, проблема ігнорується класом, Jira відмовила.

## Інше

| Метод і шлях | Призначення |
|---|---|
| `GET /projects/:id/devices` | профілі пристроїв проєкту (для вибору еталонного) |
| `GET /projects/:id/vocabulary` | елементи, класи, екрани й кандидати на заголовок екрана з UI-дерев проєкту за 30 днів — підказки сторінки налаштувань ([019](../specs/019-project-settings-page/spec.md)) |
| `GET /analytics/:projectId?days=` | Insights за 7–730 днів (типово 90; UI пропонує 30, 90, 180, 365) |
| `GET /ai/status`, `POST /ai/group-summary`, `POST /ai/a11y-labels` | AI на вимогу |
| `PUT /users/jira` | особистий токен і email Jira (`""` видаляє). Відповідь — `UserDto` з `jiraTokenSet`, без токена |
| `GET /users/me` | тепер з `jiraTokenSet` і `jiraEmail` |
| `PUT /users/:id/password` | лише `admin`: задати пароль користувачу (`password`), зокрема після відновлення з бекапу ([013](../specs/013-backups-and-secrets/spec.md)) |
| `GET /backups/status` | лише `admin`: `{ configured, lastSuccessAt, warning }`; `warning` — коли останньому бекапу понад 26 год |
| `GET /backups` | лише `admin`: стан, підключення Drive без секретів (`connected`, `email`, `folderName`), розклад, бекапи в Drive ([017](../specs/017-backup-settings-ui/spec.md)) |
| `POST /backups/drive/connect`, `POST /backups/drive/poll` | лише `admin`: вхід у Google кодом (`clientId`, `clientSecret` → `userCode`, `verificationUrl`; далі `pending` / `connected` / `failed`) |
| `POST /backups/drive/test`, `DELETE /backups/drive` | лише `admin`: перевірити папку бекапів; забути підключення |
| `PUT /backups/settings`, `POST /backups/run` | лише `admin`: час і кількість копій; запит на бекап для `vision-backup.sh --scheduled` |
