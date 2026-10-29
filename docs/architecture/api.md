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
| `GET /test-runs/:id/structure` | зміни елементів, правила (з тим, що кожне знайшло на обох знімках), шум, `compareOnly` (що порівнюється і проблеми), елементи обох знімків, пропозиції замінити область елементом |
| `POST /test-runs/:id/element-rules`, `…/element-rules/remove` | правило елемента для перевірки або проєкту: `action` — `ignore`, `tolerate` або `compare` («порівнювати лише», лише `scope: screen`, інакше `400`) ([015](../specs/015-compare-selected-elements/spec.md)) |
| `POST /test-runs/:id/ignore-areas/replace-with-element` | `{ areaId, selector }`: прибрати збережену область і додати правило «ігнорувати» для елемента, порівняти знімок один раз; відповідь `{ rule, area }` для Undo ([024](../specs/024-elements-instead-of-areas/spec.md)) |
| `GET /test-runs/:id/cross-device` | довідкове порівняння з еталонним пристроєм |
| `GET /test-runs/:id/a11y` | звіт доступності з рішеннями; заодно шукає в Jira незаведені проблеми (від імені того, хто дивиться) |
| `POST /test-runs/approve`, `POST /test-runs/reject` | як в upstream, але відповідь тепер `{ decisionId }`: запис журналу для Undo ([018](../specs/018-ui-redesign/spec.md)) |
| `POST /test-runs/undo/:decisionId` | скасувати рішення, прийняте не раніше ніж 30 s тому, лише тим, хто його прийняв: статуси й еталони — як до рішення, все або нічого. `409` — рішення вже скасоване, застаре або після нього хтось змінив знімок чи еталон (причина в `message`); `403` — рішення чуже |

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
| `POST /test-runs/:id/bug/prepare` | баг із порівняння: таска, типи, входи (серйозність без значення, «Замовник» з `role: customer`), префікс `[Automation] [фіча]`, оточення ([025](../specs/025-bug-from-comparison/spec.md)) |
| `POST /test-runs/:id/bug` | завести баг із порівняння (`parentKey`, `issueTypeId?`, `linkType?`, `fieldValues?`, `essence`, `environment?`, `steps`, `actual`, `expected`, `marks?`): мітка `vision`, позначений чекпоінт і еталон у вкладеннях. Відповідь: `{ jiraKey, jiraUrl, summary, warnings }` |
| `GET /test-runs/:id/bugs` | баги з порівняння цієї перевірки на всіх пристроях і збірках; `sameDevice` — чи позначки в пікселях цього пристрою |
| `POST /test-runs/:id/a11y/jira` | завести баг (`parentKey`, `issueTypeId?`, `linkType?`, `fieldValues?`). Відповідь: `{ jiraKey, jiraUrl, code, alreadyFiled, warnings }`. `alreadyFiled: true` — нічого не створено, прив'язано наявний |

Помилки: `409` — проблему саме зараз заводить хтось інший або її позначено як false positive;
`400` — порушення немає в знімку, проблема ігнорується класом, Jira відмовила.

## Інше

| Метод і шлях | Призначення |
|---|---|
| `GET /projects/:id/devices` | профілі пристроїв проєкту (для вибору еталонного) |
| `GET /projects` | у налаштуваннях порівняння немає `apiKey` Gemini, є `geminiApiKeySet` (як `jiraTokenSet`) |
| `PUT /projects` | необов'язкові `loadedSettings` (налаштування, як їх завантажила сторінка) і `force`. З `loadedSettings` збереження поверх чужих змін — `409` з `fields`; `force: true` зберігає попри це. `apiKey` Gemini: відсутній — лишити збережений, `""` — видалити |
| `GET /analytics/:projectId?days=` | Insights за 7–730 днів (типово 90; UI пропонує 30, 90, 180, 365) |
| `GET /ai/status`, `POST /ai/group-summary`, `POST /ai/a11y-labels` | AI на вимогу |
| `POST /ai/bug-draft` | чернетка бага з порівняння (`testRunId`, `note`, `marks?`, `changes?`, `attempt?`) на особистому ключі Gemini людини: `{ essence, steps, actual, expected, cached }`. Без ключа — 400, тайм-аут 30 с — 504 ([025](../specs/025-bug-from-comparison/spec.md)) |
| `PUT /users/jira` | особистий токен і email Jira (`""` видаляє). Відповідь — `UserDto` з `jiraTokenSet`, без токена |
| `PUT /users/gemini` | особистий ключ Gemini API (`geminiApiKey`, `""` видаляє). Відповідь — `UserDto` з `geminiKeySet`, без ключа ([ADR-0020](../decisions/0020-personal-gemini-keys.md)) |
| `GET /users/me` | тепер з `jiraTokenSet` і `jiraEmail` |
| `GET /users/all` | тепер з `lastSignInAt` (null — не входив відтоді, як це записується) |
| `PUT /users/:id/password` | лише `admin`: задати пароль користувачу (`password`), зокрема після відновлення з бекапу ([013](../specs/013-backups-and-secrets/spec.md)) |
| `GET /backups/status` | лише `admin`: `{ configured, lastSuccessAt, warning }`; `warning` — коли останньому бекапу понад 26 год |
| `GET /backups` | лише `admin`: стан, підключення Drive без секретів (`connected`, `email`, `folderName`), розклад, бекапи в Drive ([017](../specs/017-backup-settings-ui/spec.md)) |
| `POST /backups/drive/connect`, `POST /backups/drive/poll` | лише `admin`: вхід у Google кодом (`clientId`, `clientSecret` → `userCode`, `verificationUrl`; далі `pending` / `connected` / `failed`) |
| `POST /backups/drive/test`, `DELETE /backups/drive` | лише `admin`: перевірити папку бекапів; забути підключення |
| `PUT /backups/settings`, `POST /backups/run` | лише `admin`: час і кількість копій; запит на бекап для `vision-backup.sh --scheduled` |
