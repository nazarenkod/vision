# 051 — Дизайн

## Підхід

Чотири незалежні зміни, кожна — чиста функція з тестом плюс мінімальні правки там, де її
викликають. Принцип той самий, що й для VIS-SEC-043/045: спершу тести на поточну поведінку,
потім зміна, і ті самі тести лишаються зеленими (REQ-051-13).

- **Секрети (US-1).** Чиста функція `secretProblems(env)` перевіряє `JWT_SECRET` і
  `VISION_SECRET_KEY` на відомі значення, довжину після обрізання й однаковість.
  - Викликає її `bootstrap` у `main.ts` до створення застосунку, поруч із наявною перевіркою
    ключа зі специфікації 044, і зупиняє процес.
  - Застосунок у e2e-тестах збирається без `main.ts`, тож тести не зачіпаються. Контрольний
    сценарій, інструкція розробника й приклади отримують довгі значення.
- **Jira (US-2).** Уся перевірка адреси вже йде через `jiraHostProblem` / `isAllowedJiraUrl`
  (`jira-hosts.ts`): при збереженні проєкту, у `jiraAccess` і `settingsJira`. Змінюємо лише їх.
  - Запис-хост пропускає `https` на 443.
  - Запис `схема://хост:порт` пропускає саме ці схему, хост і порт.
  - `JiraClient.request` іде з `redirect: 'manual'`: відповідь 3xx — помилка з адресою з
    `Location`, токен далі не йде.
  - Маршрут `jira/types` спершу перевіряє, що проєкт існує (`findOne`). Доступ до нього вже
    перевіряє `ProjectAccessInterceptor`.
- **Області ігнорування (US-3).** `@ArrayMaxSize(20)` на всіх DTO з `ignoreAreas`. У multipart
  DTO досі не було й валідації елементів, тож додаємо `@IsArray` / `@ValidateNested`.
  - Маршрут `ignoreAreas/add` додає до збережених областей, тому сервіс спершу перевіряє суму для
    всіх `ids` і лише тоді пише (REQ-051-09: нічого не зберігати).
  - Інтерфейс перевіряє ліміт до запиту й показує його. Намальовані області лишаються в стані
    (REQ-051-14).
- **Вирази (US-4).** Новий модуль `linear-regex.ts` компілює вираз правила рушієм із лінійним
  часом (`re2js`, MIT, без залежностей, чистий JS: Docker-збірці не потрібні нативні модулі).
  - **Перекладач.** RE2 трактує частину конструкцій інакше, ніж JavaScript, тож перекладач
    переписує їх явно, щоб збіги були тими самими. Зараз так:
    - `\s` і `\S` → класи пробілів JavaScript (з NBSP, вузьким пробілом тощо);
    - `.` → «будь-що, крім `\n \r    `»;
    - `\uXXXX` і `\u{…}` → `\x{…}`.
  - **Що не приймається.** Зворотні посилання та перевірки вперед і назад, а також усе, що
    JavaScript приймає, а RE2 не виконує так само (повтор понад 1000, `(?s:…)`, невідома
    властивість Unicode) — проблема `'pattern'` (REQ-051-10). Правило ніколи мовчки не вимикається:
    стара причина видна в рядку правила.
  - **Розмір програми (аудит 2026-11-08, VIS-SEC-058).** Час RE2 лінійний і в тексті, і в розмірі
    скомпільованої програми, а повтори його множать: `(?:x*…){1000}` у 300 символах давав 274 000
    інструкцій, 46 МіБ і понад секунду на 200 символах. `programEstimate` до компіляції рахує верхню
    межу інструкцій з тексту виразу, після компіляції це перевіряє `programSize()`; понад
    `MAX_PROGRAM` (4000) — `'unsupported'`, тобто `'pattern'` для людини. Звичайні вирази — до 300
    інструкцій, `.{0,1000}` — 2002. Кеш скомпільованих виразів обмежений сумою інструкцій (200 000),
    а не кількістю. `GET /test-runs/:id/selector-matches` не рахує селектор, довший за 300 символів
    (як у правилі), — проблема `'too-long'`.
  - **Сумісність.** Дефіс поруч із класом у квадратних дужках (`[\s-x]`) — звичайний символ, як
    за правилами сумісності JavaScript; довгі назви властивостей і короткі коди письменностей
    (`Script=Cyrl`) перекладаються; `Cased_Letter` — це `Lu`, `Ll` і `Lt`.
  - **Де використовується.** `parseSelector` (`text:/…/`) і `variable-text.ts` (033) беруть
    лінійний вираз замість `RegExp`. `selectorProblem` і `partsProblem` при збереженні
    повертають причину.
  - **Старі правила.** Збережене правило з таким виразом має проблему `'pattern'`, не знаходить
    елемента (вже так для виразів, що не розбираються), а в `structure` у правила є поле
    `problem` (REQ-051-12).
- **Порожня конфігурація порівняння (баг, не вимога 051).** `parseConfig` pixelmatch підставляє
  типовий поріг, коли його немає: без порогу pixelmatch не бачив жодної зміни. Решта ключів і
  інші порівнювачі (looks-same, odiff, VLM) читаються як раніше.

## Компоненти

| Компонент | Шлях | Роль |
|---|---|---|
| Перевірка секретів | `backend/src/shared/server-secrets.ts` | `secretProblems(env)`: відомі значення, довжина, однаковість |
| Старт API | `backend/src/main.ts` | зупиняє старт із причиною |
| Хости Jira | `backend/src/a11y/jira-hosts.ts` | записи-хости й записи `схема://хост:порт`; https/443 типово |
| Клієнт Jira | `backend/src/a11y/jira.client.ts` | без переходу за переадресацією |
| Типи Jira | `backend/src/projects/projects.controller.ts` | перевірка, що проєкт існує |
| DTO областей | `backend/src/test-runs/dto/*ignore-area*.ts`, `create-test-request*.dto.ts` | `ArrayMaxSize(20)` |
| Додавання областей | `backend/src/test-runs/test-runs.service.ts`, `test-runs.controller.ts` | перевірка суми до запису |
| Лінійні вирази | `backend/src/ui-tree/linear-regex.ts` | переклад і компіляція, причина відмови |
| Селектори й 033 | `backend/src/ui-tree/comparison-inputs.ts`, `variable-text.ts` | лінійний вираз замість `RegExp` |
| Правила в структурі | `backend/src/ui-tree/ui-tree.service.ts` | поле `problem` у правила |
| Конфігурація порівняння | `backend/src/compare/libs/pixelmatch/pixelmatch.service.ts` | типовий поріг, коли його немає |
| Інтерфейс | `frontend/src/components/TestDetailsDialog/TestDetailsModal.tsx`, `WhatsCompared.tsx`, `frontend/src/i18n/{en,uk}.ts`, `frontend/src/types/insights.ts` | ліміт областей, проблема `pattern` |
| Документація | `DEPLOY.md`, `docs/guides/development.md`, `.env.demo.example`, `backend/.env.example`, `scripts/control-scenario.sh` | нові секрети, формат `VISION_JIRA_HOSTS` |

## Дані

Схема не змінюється. Збережені області понад 20 і правила з виразами, які тепер не
приймаються, лишаються в базі як є: перші порівнюються як раніше, другі показують проблему.

## Ризики

| Ризик | Що робимо |
|---|---|
| Лінійний рушій знаходить не те, що `RegExp` | диференційний тест: вирази з тестів, прикладів 033 і генератора `patternFor` × тексти з фікстур і краєвих символів (NBSP, `\r`, кирилиця, регістр) — однакові відповіді |
| Чинна інсталяція з коротким секретом не стартує | рішення власника: токенів ще ніхто не вводив; повідомлення називає змінну й команду генерації |
| Контрольний сценарій ганяє мок-Jira по http на випадковому порту | запис `http://хост:порт` у `VISION_JIRA_HOSTS`, порт відомий до старту API |
| 10⁶ областей у JSON довго перевіряються поелементно | `ListLengthPipe` перевіряє довжину списку до `ValidationPipe`; тест вимірює час відмови |
| Ширше доповнення конфігурації порівняння змінило б поведінку odiff і часткових конфігурацій | доповнюється лише відсутній поріг pixelmatch, решта ключів — як збережено (рев'ю 2026-11-08) |

## Перевірка вимог

| Вимога | Перевірка |
|---|---|
| REQ-051-01 | `backend/src/shared/server-secrets.spec.ts › refuses a secret from the examples and the docs` |
| REQ-051-02 | `backend/src/shared/server-secrets.spec.ts › refuses a secret shorter than 32 characters` |
| REQ-051-03 | `backend/src/shared/server-secrets.spec.ts › refuses the same value for both secrets` |
| REQ-051-04 | `manual: DEPLOY.md, таблиця змінних: JWT_SECRET — новий випадковий секрет, без поради взяти секрет робочого VRT` |
| REQ-051-05 | `backend/src/a11y/jira-hosts.spec.ts › sends a token only over https on the standard port of an allowed host` |
| REQ-051-06 | `backend/src/a11y/jira-hosts.spec.ts › takes the scheme and port an entry names` |
| REQ-051-07 | `backend/src/a11y/jira.client.spec.ts › does not follow a redirect with the token` |
| REQ-051-08 | `backend/src/projects/projects.controller.spec.ts › checks the project before asking Jira for its types` |
| REQ-051-09 | `backend/src/test-runs/dto/ignore-area-limit.spec.ts › turns away more than 20 ignore areas on every route`; `backend/src/test-runs/test-runs.service.spec.ts › adds no ignore area to any run when one would pass the limit` |
| REQ-051-10 | `backend/src/ui-tree/linear-regex.spec.ts › refuses back-references and look-around with a reason`; `backend/src/ui-tree/linear-regex.spec.ts › refuses a pattern whose repeats unroll too large, at once and with a reason`; `backend/src/test-runs/test-runs.service.spec.ts › turns away a selector longer than a rule holds and a pattern too large to run` |
| REQ-051-11 | `backend/src/ui-tree/linear-regex.spec.ts › checks a catastrophic pattern on 2000 characters in under 50 ms`; `backend/src/ui-tree/linear-regex.spec.ts › checks the largest pattern it takes on 2000 characters in under 50 ms`; `backend/src/ui-tree/linear-regex.spec.ts › never counts a program smaller than RE2 builds it`; `backend/src/ui-tree/linear-regex.spec.ts › keeps no more compiled patterns than its budget of instructions` |
| REQ-051-12 | `backend/src/ui-tree/ui-tree.service.spec.ts › shows why a stored rule with a pattern Vision no longer runs finds nothing` |
| REQ-051-13 | `backend/src/ui-tree/linear-regex.spec.ts › finds what RegExp found for every pattern and text`; `backend/src/ui-tree/linear-regex.spec.ts › takes the repeats people write, up to a thousand of a character or two`; `backend/src/ui-tree/structure.characterization.spec.ts › offers the same elements…`; `backend/src/a11y/jira-hosts.spec.ts › takes an https address on an allowed host as before`; `backend/src/shared/server-secrets.spec.ts › takes the secrets the instructions make` |
| REQ-051-14 | `frontend/src/components/TestDetailsDialog/ignoreAreaLimit.test.ts › keeps the areas and names the limit when there are too many` |
