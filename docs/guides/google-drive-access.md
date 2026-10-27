# Доступ Vision до Google Drive для бекапів

Як отримати OAuth-клієнт Google і підключити Drive на сторінці Backups
([017](../specs/017-backup-settings-ui/spec.md)). Перевірено на сервері 2026-10-27 з робочим
акаунтом Google Workspace банку. Займає 5–10 хвилин у браузері; на сервері нічого не потрібно.

## Чому саме так

Ми спробували три шляхи, працює лише третій:

| Шлях | Що сталося |
|---|---|
| rclone на сервері й `rclone config` з браузером | rclone.org із сервера не відкривається, а на Mac не вдалося встановити Command Line Tools для brew. rclone тепер запускається з Docker-образу, але вхід у Google так і лишався проблемою |
| Сервісний акаунт Google + спільний диск | Workspace банку не дає ділитися файлами на спільних дисках з акаунтами поза доменом: «Аккаунт …iam.gserviceaccount.com не относится к домену ПриватБанк». А на «Моєму диску» сервісного акаунта немає місця |
| **OAuth-клієнт «TVs and Limited Input devices» + вхід кодом** | працює: Vision показує код, людина вводить його на google.com/device робочим акаунтом. Перенаправлення OAuth Google дозволяє лише на https або localhost, а Vision у мережі банку — на http, тому саме вхід кодом |

Що з цього випливає:

- Бекапи лежать у папці `vision-backups` на «Моєму диску» того, хто підключив Drive. Vision має
  доступ лише до файлів, які створив сам (`drive.file`), а не до всього Drive.
- Якщо цю людину відключать від Workspace, бекапи зникнуть разом з її Drive. Тоді хтось інший
  повторює кроки нижче своїм акаунтом.
- Client secret і токен лежать лише на сервері в `demo-data/backup-config/` (права `600`), не в
  базі й не в бекапі, і в інтерфейс не повертаються ([ADR-0012](../decisions/0012-backups-without-secrets.md),
  [ADR-0013](../decisions/0013-ui-drives-host-scripts-through-files.md)).

## Перед початком

- Увійти в <https://console.cloud.google.com> **робочим акаунтом** банку.
- Вгорі ліворуч, у виборі проєкту, перевірити, що проєкт належить **організації банку** (над
  списком — назва організації, а не «No organization»). Підходить наявний проєкт в організації;
  новий: **New project** → **Location** — організація банку. Немає прав створювати проєкти —
  потрібен адміністратор Google Cloud банку.

## Крок 1. Google Drive API

☰ → **APIs & Services** → **Library** → **Google Drive API** → **Enable**.

## Крок 2. Екран згоди

☰ → **APIs & Services** → **OAuth consent screen** (у новому інтерфейсі — **Google Auth Platform**).

- Якщо є **Get started**: App name `Vision backups`, User support email — свій, **Audience:
  Internal**, Contact information — свій email, погодитись → **Create**.
- Якщо екран уже налаштований: вкладка **Audience** → **User type = Internal**.

**Internal** обов'язково. Якщо його немає, проєкт поза організацією банку: у типу External у
режимі Testing доступ пропадає кожні 7 днів, і нічні бекапи почнуть падати.

Вкладку **Data access** (scopes) заповнювати не треба: Vision сам просить лише `drive.file` і
email.

## Крок 3. OAuth-клієнт

**Google Auth Platform** → **Clients** → **Create client** (або **APIs & Services** →
**Credentials** → **Create credentials** → **OAuth client ID**):

- **Application type: TVs and Limited Input devices**. З «Web application» чи «Desktop app» вхід
  кодом не працює;
- **Name:** `vision-backups`;
- **Create** → одразу зберегти **Client ID** (`….apps.googleusercontent.com`) і **Client secret**,
  найкраще кнопкою **Download JSON**: повністю secret видно лише в момент створення.

Client secret нікуди не пересилати: ні в чат, ні агенту. Його вводить лише людина на сторінці
Backups.

## Крок 4. Підключити у Vision

1. Vision під адміністратором → аватар → **Backups** → блок **Google Drive**.
2. Вставити **Client ID** і **Client secret** → **Connect**.
3. Відкрити показану адресу `https://www.google.com/device` на будь-якому пристрої, увійти **тим
   самим робочим акаунтом**, ввести код, **Allow**.
4. За кілька секунд — «Connected as …». Натиснути **Test connection**.

Далі — перший бекап і розклад: [DEPLOY.md](../../DEPLOY.md), §12, або для агента
[backup-trial](backup-trial.md), кроки 4–6. Без cron кнопка **Back up now** лише ставить запит:
його виконує `./scripts/vision-backup.sh --scheduled` (cron кожні 5 хвилин або вручну).

## Якщо щось не так

| Що видно | Причина й дія |
|---|---|
| `invalid_client` після Connect | хибний Client ID чи secret або клієнт іншого типу; потрібен **TVs and Limited Input devices** |
| «Access was denied in Google» | на google.com/device натиснули Cancel або увійшли не робочим акаунтом; **Start again** |
| «This app is blocked», «Admin policy» | адміністратор Workspace блокує сторонні застосунки; попросити дозволити застосунок за Client ID |
| «The code expired» | код діє близько 30 хвилин; **Start again** |
| `org_internal`, «not available to users outside the organization» | увійшли не акаунтом організації банку |
| «Signed in, but the backup folder could not be made» | Drive API не ввімкнено (крок 1) або Drive акаунта заповнений |
| «Google refused the saved sign-in … Reconnect» | доступ відкликали в Google або видалили клієнт; **Disconnect** і підключити знову |

## Перенести на нову машину

Підключення лежить у `demo-data/backup-config/` і не потрапляє в бекап. На новій машині Drive
підключають заново тим самим робочим акаунтом і **тим самим OAuth-клієнтом**: з іншим клієнтом
Vision не побачить уже створені бекапи (`drive.file` прив'язаний до застосунку).
