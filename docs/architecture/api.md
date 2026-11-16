# API Vision

Тут лише ендпоінти, які додав або змінив Vision. Повний перелік зі схемами дає Swagger API
(`/api`). Автентифікація: JWT користувача або API-ключ (`apiKey`); сервер шукає ключ за його
SHA-256 і сам ключ не зберігає ([044](../specs/044-secrets-at-rest/spec.md)). Дії, що
змінюють рішення, доступні ролям `admin` і `editor`.

**Помилки ([045](../specs/045-sign-in-and-api-hardening/spec.md)).** Відповідь — `{ statusCode, message, path }`,
для конфлікту налаштувань ще `fields`; без stack trace і об'єкта винятку, неочікувана помилка — «Internal
server error». CORS — лише для origin `APP_FRONTEND_URL`; Swagger (`/api`) — лише з `VISION_SWAGGER=true`;
кожна відповідь має `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`.

**Доступ до проєктів ([042](../specs/042-project-access/spec.md)).** Адмін бачить усі проєкти; решта
(і їхні API-ключі) — лише ті, до яких дали доступ. Будь-який маршрут з даними чужого проєкту
відповідає `404 Not found`; `POST /builds`, `POST /test-runs`, `/test-runs/multipart` —
`403` «No access to this project: ask an admin of Vision to add you to it».

## Події наживо (socket.io)

Шлях `/socket.io`, той самий порт, що й API ([032](../specs/032-authenticated-events/spec.md),
[ADR-0023](../decisions/0023-events-socket-behind-login.md)). У вихідному проєкті сокет був відкритий усім.

| Що | Як |
|---|---|
| Рукостискання | `auth: { token: <JWT входу> }` — той самий токен, що в `Authorization: Bearer`. Немає, чужий підпис, термін сплив, користувача немає — `connect_error` з `message: "unauthorized"`. `apiKey` не приймається. Роль не перевіряється |
| Термін токена | коли спливає `exp`, сервер розриває з'єднання (`io server disconnect`); повторна спроба з тим самим токеном отримує `unauthorized` |
| `subscribe` `{ projectId }` | підписка на проєкт, одна на з'єднання: попередня знімається. Ack `{ ok: true }`; `{ ok: false }` — проєкту чи користувача немає або немає доступу до проєкту (042). `projectId: null` — лише відписатися |
| Події | `build_created`, `build_deleted` (один `Build`), `build_updated`, `testRun_created`, `testRun_updated`, `testRun_deleted` (масиви) — лише в кімнату проєкту запису, з `fileSignatures` знімків ([043](../specs/043-protected-images/spec.md)). Без підписки подій немає |

## Прийом

| Метод і шлях | Що нового |
|---|---|
| `POST /test-runs`, `POST /test-runs/multipart` | необов'язкові `uiTree` (gzip + base64 XML; у multipart — файл), `uiTreeFormat` (`appium-android` / `appium-ios`), `deviceDensity`. Якщо в проєкті є перелік дозволених пристроїв, а `device` + `os` у нього не входять, — `422` з текстом для лога тесту, нічого не створюється; запити з `User-Agent: vision-cli/…` не перевіряються ([029](../specs/029-allowed-devices/spec.md)) |

## Рев'ю знімка

| Метод і шлях | Призначення |
|---|---|
| `GET /test-runs/groups?buildId=` | групи змін збірки |
| `GET /test-runs/:id/structure` | зміни елементів, правила (з тим, що кожне знайшло на обох знімках), шум, `compareOnly` (що порівнюється, обрані елементи поіменно зі зсувом у dp, проблеми, зокрема порівняння за одним деревом, [030](../specs/030-whats-compared/spec.md)), `size` знімка й `systemBarsFrom` (хто вимкнув системні панелі), елементи обох знімків (безіменні — з `nameless` і `variants`, [027](../specs/027-nameless-elements/spec.md)), пропозиції замінити область елементом |
| `GET /test-runs/:id/trend` | тренд перевірки для заголовка порівняння: до 20 останніх прогонів тієї самої варіації до цього включно, від старішого, кожен — `id`, `buildNumber`, `createdAt`, `status`, `diffPercent` (чиста `checkTrend`, [046](../specs/046-design-review-refresh/spec.md)) |
| `POST /test-runs/:id/element-rules`, `…/element-rules/remove` | правило елемента для перевірки або проєкту: `action` — `ignore`, `tolerate`, `compare` («порівнювати лише», лише `scope: screen`, інакше `400`) ([015](../specs/015-compare-selected-elements/spec.md)) або `variable` з `parts` (хоча б одне місце з виразом, що розбирається, інакше `400`); `replacesRuleId` прибирає правило того самого `scope` в тому ж записі ([033](../specs/033-variable-text/spec.md)); селектор `id:`, `class:`, `text:` або `xpath:` — шлях від стабільного елемента, інакше `400` ([027](../specs/027-nameless-elements/spec.md)) |
| `GET /test-runs/:id/selector-matches?selector=…` | скільки елементів селектор знаходить на еталоні й на знімку (`current`, `baseline`) або чому його не можна вжити (`problem`: `prefix`, `syntax`, `anchor`, `attribute`, `axis`, `function`, `or`, `mixed`); лише читає ([027](../specs/027-nameless-elements/spec.md)) |
| `POST /test-runs/:id/ignore-areas/replace-with-element` | `{ areaId, selector }`: прибрати збережену область і додати правило «ігнорувати» для елемента, порівняти знімок один раз; відповідь `{ rule, area }` для Undo ([024](../specs/024-elements-instead-of-areas/spec.md)) |
| `GET /test-runs/:id/a11y` | звіт доступності з рішеннями; заодно шукає в Jira незаведені проблеми (від імені того, хто дивиться) |
| `POST /test-runs/approve`, `POST /test-runs/reject` | як у вихідному проєкті, але відповідь тепер `{ decisionId }`: запис журналу для Undo ([018](../specs/018-ui-redesign/spec.md)) |
| `POST /test-runs/undo/:decisionId` | скасувати рішення, прийняте не раніше ніж 30 s тому, лише тим, хто його прийняв: статуси й еталони — як до рішення, все або нічого. `409` — рішення вже скасоване, застаре або після нього хтось змінив знімок чи еталон (причина в `message`); `403` — рішення чуже |

## Знімки ([043](../specs/043-protected-images/spec.md))

Кожна JSON-відповідь маршруту з входом чи API-ключем, де є `imageName`, `diffName`,
`baselineName`, `imageThumbnailName` або `diffThumbnailName`, має поруч `fileSignatures:
{ <ім'я файла>: <підпис> }`. Підпис — HMAC імені ключем, виведеним з `VISION_SECRET_KEY`: діє,
доки файл існує, лише для нього. Інших шляхів до файлів немає: ні `/<ім'я>` в API, ні
`/static/imageUploads` в nginx інтерфейсу.

| Метод і шлях | Призначення |
|---|---|
| `GET /images/:name?sig=` | PNG за підписом: `Cache-Control: private, max-age=31536000, immutable`, `Access-Control-Allow-Origin` — лише `APP_FRONTEND_URL`. Без підпису, з чужим чи для не-PNG — `404`, ім'я зі шляхом — `400`. Сховище S3 — перенаправлення на підписану адресу |
| `GET /images/:name/download?sig=` | ті самі байти вкладенням, для zip в інтерфейсі |

## Огляд і звіт збірки ([031](../specs/031-build-overview/spec.md))

| Метод і шлях | Призначення |
|---|---|
| `GET /builds/:id/overview` | зведення збірки для вкладки Overview: вердикт, числа, прогрес рев'ю з іменами людей, пристрої з розміром екрана (`screen`, з PNG одного знімка), фічі й фічі без змін (`quietFeatures.features`; `grouped` — рядок фічі з `featureName` і її перевірками в `checks`, [048](../specs/048-overview-checks-table/spec.md), інакше одна перевірка), баги Jira (нові й відомі), порівняння з попередньою збіркою гілки, `asOf`. Без AI |
| `GET /builds/:id/report` | звіт збірки з усіма розділами: зведення, до 20 змін зі знімками (`moreChanges` — решта), рядки доступності |
| `GET /builds/:id/report-links` | невідкликані публічні посилання збірки з автором і датою |
| `POST /builds/:id/report-links` | `admin`, `editor`: `{ sections, language }` → посилання з `token`, без терміну дії |
| `DELETE /report-links/:id` | відкликати: автор або `admin`, інакше `403` |
| `GET /public/reports/:token` | **без входу** ([ADR-0022](../decisions/0022-public-report-links.md)): звіт із розділами й мовою посилання, лише білий список полів; `fileSignatures` знімків — підписами звіту, що діють, доки посилання чинне ([043](../specs/043-protected-images/spec.md)); `{ state: "expired" }` або `{ state: "gone" }` без даних збірки. `ETag`; той самий `If-None-Match` — `304` |

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
| `GET /projects` | у налаштуваннях порівняння немає `apiKey` Gemini, є `geminiApiKeySet`; спільних `jiraToken`, `jiraEmail`, `jiraTokenSet` немає зовсім ([035](../specs/035-admin-accounts/spec.md)) |
| `GET /projects/:id/devices` | різні пари `{ device, os }` з варіацій проєкту — підказка для переліку дозволених пристроїв ([029](../specs/029-allowed-devices/spec.md)) |
| `GET /projects/:id/jira/types?url=` | `admin`, `editor`: типи задач (`{ name, subtask }`) і типи зв'язків, які бачить у Jira за адресою `url` (можна ще не збережену) той, хто питає, з його особистим токеном; або `{ problem: notSet \| hostNotAllowed \| noToken \| failed }` ([049](../specs/049-settings-explained/spec.md)) |
| `PUT /projects` | необов'язкові `loadedSettings` (налаштування, як їх завантажила сторінка) і `force`. З `loadedSettings` збереження поверх чужих змін — `409` з `fields`; `force: true` зберігає попри це. `apiKey` Gemini: відсутній — лишити збережений, `""` — видалити; зберігається зашифрованим. `jiraUrl` на хості не з `VISION_JIRA_HOSTS` — `400` з переліком дозволених ([044](../specs/044-secrets-at-rest/spec.md)). `uiTreeSettings.allowedDevices` із `*` деінде, ніж у кінці OS (`26.*`), — `400`. `jiraToken` і `jiraEmail` ігноруються |
| `GET /analytics/:projectId?days=` | Insights за 7–730 днів (типово 90; UI пропонує 30, 90, 180, 365); пристрій — рядком `device`/`devices` і по полях `profile`/`profiles` для тегів ([036](../specs/037-device-as-tags/spec.md)) |
| `GET /ai/status`, `POST /ai/group-summary`, `POST /ai/a11y-labels` | AI на вимогу |
| `POST /ai/bug-draft` | чернетка бага з порівняння (`testRunId`, `note`, `marks?`, `changes?`, `attempt?`) на особистому ключі Gemini людини: `{ essence, steps, actual, expected, cached }`. Без ключа — 400, тайм-аут 30 с — 504 ([025](../specs/025-bug-from-comparison/spec.md)) |
| `POST /users` | лише `admin`: створити акаунт (`email`, `password`, `role`, `firstName?`, `lastName?`). Відповідь — `UserDto` без токена входу. Пошта зайнята (будь-який регістр) — `400`; пароль коротший за 12 символів — `400`. Працює й з LDAP чи SSO ([045](../specs/045-sign-in-and-api-hardening/spec.md)). `POST /users/register` прибрано ([035](../specs/035-admin-accounts/spec.md)) |
| `GET /users/accounts/enabled` | без входу: чи можна створювати акаунти; з 045 — завжди `true` |
| `POST /users/login` | з LDAP: спершу каталог, кого там немає — локальний пароль; з SSO — лише локальні акаунти. 5 невдалих спроб для email за 15 хвилин — `429` на 15 хвилин ([045](../specs/045-sign-in-and-api-hardening/spec.md)) |
| `PUT /users/jira` | особистий токен і email Jira (`""` видаляє), токен зберігається зашифрованим. Відповідь — `UserDto` з `jiraTokenSet`, без токена |
| `GET /users/newApiKey` | новий API-ключ текстом — єдиний раз, коли його видно; попередній перестає діяти. `UserDto` далі має лише `apiKeyEnding` (останні 4 символи, `null` — ключа ніхто не бачив) замість `apiKey` ([044](../specs/044-secrets-at-rest/spec.md)) |
| `PUT /users/gemini` | особистий ключ Gemini API (`geminiApiKey`, `""` видаляє). Відповідь — `UserDto` з `geminiKeySet`, без ключа ([ADR-0020](../decisions/0020-personal-gemini-keys.md)) |
| `GET /users/me` | тепер з `jiraTokenSet` і `jiraEmail` |
| `GET /users/all` | тепер з `lastSignInAt` (null — не входив відтоді, як це записується) і `projects: [{ id, name }]` — до чого дали доступ (адміну не потрібно) |
| `GET /projects` | лише проєкти з доступом; адміну — усі |
| `GET /projects/:id/access` | лише `admin`: кому дали проєкт (`userId`, `email`, імена, `role`, `createdAt`); адмінів немає в переліку |
| `PUT`, `DELETE /projects/:id/access/:userId` | лише `admin`: дати чи забрати доступ; відповідь — новий перелік. Забрали — сокети людини виходять з кімнати проєкту |
| `PUT /users/:id/password` | лише `admin`: задати пароль користувачу (`password`), зокрема після відновлення з бекапу ([013](../specs/013-backups-and-secrets/spec.md)) |
| `GET /backups/status` | лише `admin`: `{ configured, lastSuccessAt, warning }`; `warning` — коли останньому бекапу понад 26 год |
| `GET /backups` | лише `admin`: стан, підключення Drive без секретів (`connected`, `email`, `folderName`), розклад, бекапи в Drive ([017](../specs/017-backup-settings-ui/spec.md)) |
| `POST /backups/drive/connect`, `POST /backups/drive/poll` | лише `admin`: вхід у Google кодом (`clientId`, `clientSecret` → `userCode`, `verificationUrl`; далі `pending` / `connected` / `failed`) |
| `POST /backups/drive/test`, `DELETE /backups/drive` | лише `admin`: перевірити папку бекапів; забути підключення |
| `PUT /backups/settings`, `POST /backups/run` | лише `admin`: час і кількість копій; запит на бекап для `vision-backup.sh --scheduled` |
