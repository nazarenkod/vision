# Пробний бекап на сервері з робочим VRT

Інструкція для агента (і людини), який перевіряє на сервері налаштування бекапів і перший
бекап: [013](../specs/013-backups-and-secrets/spec.md), [017](../specs/017-backup-settings-ui/spec.md).
Виконуй кроки по черзі. Не переходь до наступного, поки поточний не дав очікуваного
результату. Не імпровізуй: якщо щось іде не за інструкцією, зупинись і поклич людину.

## Мета й межі

- **Мета:** оновити код Vision, підключити Google Drive на сторінці Backups, зробити перший
  бекап і перевірити кнопку «Back up now».
- **Робочий VRT не повинен постраждати за жодних умов** ([ADR-0002](../decisions/0002-production-is-read-only.md)):
  його не зупиняють, не перезапускають, не оновлюють, у його базу й файли не пишуть.
- **Базу Vision не оновлюють і не замінюють:** Vision лишається на своїх поточних даних.

## Заборонено

| Не роби | Чому |
|---|---|
| `./scripts/vision-restore.sh` | замінює базу Vision; відновлення тут не перевіряємо |
| `./scripts/demo-clone-from-prod.sh` | замінює дані Vision свіжою копією проду |
| `docker compose …`, `docker-compose …` напряму | лише `./scripts/vision.sh`: він не дає зачепити проєкт проду |
| `docker stop/rm/restart` будь-яких контейнерів, `docker system prune`, `docker volume prune`, `docker image prune` | можна зачепити прод |
| будь-що з контейнерами, томами чи папками VRT; `psql` до бази проду | прод лише читає `demo-clone-from-prod.sh`, і його тут не запускаємо |
| `sudo`, якщо `./scripts/vision.sh` зазвичай запускають без нього (і навпаки) | файли бекапу мають належати тому самому користувачу |
| видаляти будь-що, крім того, що прямо названо в «Відкат» | — |
| змінювати `.env.demo`, крім рядків, названих нижче | — |
| пуш, коміти, зміни коду на сервері | лише `git pull` |

Скрипти Vision мають власні запобіжники: працюють лише з проєктом `vision`, відмовляються, якщо
в ньому є чужі контейнери, і лишають на диску запас 10 ГБ або 5%. Якщо скрипт відмовився й
пояснив чому, **не обходь це**: зупинись і передай повідомлення людині.

## Що бекап робить на сервері

- **Читає** базу Vision (`pg_dump` у контейнері бази Vision з `nice 19`) і `demo-data/imageUploads`.
  Якщо картинки підключені жорсткими посиланнями на файли проду (`PROD_IMAGES_MODE=link`),
  вони лише читаються.
- **Пише** тільки в `demo-data/backups`, `demo-data/backup-status`, `demo-data/backup-config` і в
  Google Drive.
- Нічого не пише в базу Vision і нічого не робить з VRT.

## Крок 0. Перевірки без змін

Усе — з кореня репозиторію Vision, від того користувача, який зазвичай запускає
`./scripts/vision.sh`.

```bash
git status --short && git log --oneline -1
df -h .
du -sh demo-data/imageUploads
docker pull rclone/rclone:1.68.2
```

| Перевірка | Очікується | Інакше |
|---|---|---|
| `git status --short` | порожньо | зупинись: на сервері є локальні зміни, людина вирішує, що з ними |
| `df -h .` | вільно щонайменше 15 ГБ | зупинись і передай людині цифри |
| `du -sh demo-data/imageUploads` | запиши розмір у звіт | понад 20 ГБ — зупинись: першому бекапу треба обмеження швидкості, людина має погодити |
| `docker pull rclone/rclone:1.68.2` | `Status: … rclone/rclone:1.68.2` | якщо rclone встановлено на хості (`rclone version`), можна далі; інакше зупинись |

## Крок 1. Оновити код Vision

Попередь людину: Vision буде недоступний кілька хвилин, а збирання образів забирає CPU тієї ж
машини, що й прод. Краще робити поза піковими годинами. Продовжуй після її згоди.

```bash
git pull
./scripts/vision.sh up -d --build
./scripts/vision.sh ps -a
./scripts/vision.sh logs migration | tail -20
```

Очікується:
- `api`, `ui`, `postgres` — `running` (або `Up`), `migration` — `exited (0)`;
- у журналі `migration` немає помилок.

Якщо `vision.sh` відмовився («containers that were not created from …», «Not enough disk …»)
або міграція впала — зупинись, нічого не виправляй, передай людині вивід.

Перевір, що API Vision бачить Google:

```bash
./scripts/vision.sh exec -T api node -e "fetch('https://oauth2.googleapis.com/device/code',{method:'POST'}).then(r=>console.log('Google answered',r.status)).catch(e=>console.log('NO ACCESS:',e.message))"
```

- `Google answered 400` — добре, далі.
- `NO ACCESS: …` — зупинись: контейнеру потрібен проксі, це зміна конфігурації для людини й
  розробника.

## Крок 2. OAuth-клієнт Google (робить людина)

Агент цього не робить: потрібен браузер і права в Google Cloud проєкті банку. Попроси людину
(якщо ще не зроблено, деталі в [DEPLOY.md](../../DEPLOY.md), §12):

1. Google Cloud Console → проєкт банку → «APIs & Services» → «Library» → **Google Drive API** → Enable.
2. «OAuth consent screen» → тип **Internal**. Якщо Internal недоступний — зупинись: проєкт поза
   організацією банку, доступ зникав би кожні 7 днів.
3. «Credentials» → «Create credentials» → «OAuth client ID» → тип **TVs and Limited Input
   devices** → зберегти Client ID і Client secret.

Client secret агенту не потрібен: його вводить людина в інтерфейсі.

## Крок 3. Підключити Google Drive (робить людина в інтерфейсі)

Попроси людину:

1. Відкрити Vision під адміністратором → аватар угорі праворуч → **Backups**.
2. У блоці «Google Drive» вставити Client ID і Client secret → **Connect**.
3. Відкрити показану адресу (google.com/device) на будь-якому пристрої, увійти **робочим**
   акаунтом, ввести код, дозволити доступ.
4. Дочекатися «Connected as …» і натиснути **Test connection** — має бути «The backup folder is
   reachable».

Після підключення жовта смуга «Vision has not been backed up yet» — це нормально до першого
бекапу.

Перевір на сервері, що підключення збережене й належить правильному користувачу:

```bash
ls -l demo-data/backup-config/
```

Очікується: `drive.json` і `rclone.conf` з правами `-rw-------`, власник — поточний користувач.
Якщо власник `root`, а ти не root — зупинись і передай людині (Vision запускали іншим
користувачем).

## Крок 4. Перший бекап

```bash
./scripts/vision-backup.sh
```

Перший запуск передає всі картинки, тож може йти довго. Не переривай його.

| Результат | Що означає | Дія |
|---|---|---|
| останній рядок `==> Done.`, код 0 | бекап у Drive | далі |
| `exit 3`, «uploaded on the next run» | бекап лише локальний, передача не вдалася | зупинись, передай вивід |
| `!!  …` і код 1 | бекапу немає; скрипт пояснив чому | зупинись, передай вивід |

Перевір:

```bash
cat demo-data/backup-status/status.json
ls -l demo-data/backups/
```

Очікується: `"lastError": null`, `"lastSuccessAt"` — щойно, `"pendingUploads": 0`; у
`demo-data/backups/` — файл `vision-<час>.tar` і `vision-<час>.tar.uploaded`.

Попроси людину оновити сторінку Backups: у «In Google Drive» з'явився бекап, жовтої смуги
немає, а на «Моєму диску» — папка `vision-backups` з `db` і `images`.

## Крок 5. «Back up now» без cron

1. Попроси людину натиснути **Back up now** на сторінці Backups.
2. Перевір, що запит дійшов: `cat demo-data/backup-config/backup-requested` показує час.
3. Виконай те, що робитиме cron:

   ```bash
   ./scripts/vision-backup.sh --scheduled
   ```

   Очікується рядок `backup asked for on the Backups page`, наприкінці `==> Done.`, файл
   `backup-requested` зник, у списку на сторінці — другий бекап.
4. Ще раз `./scripts/vision-backup.sh --scheduled`: має завершитися мовчки, без виводу. Нічого
   не просили, а бекап після денного часу (типово 03:17) сьогодні вже був, тож він зарахований як денний.

## Крок 6. Розклад — лише з дозволу людини

Cron робитиме нічний бекап і виконуватиме «Back up now» протягом 5 хвилин. Запитай людину, чи
вмикати. Якщо так:

```bash
./scripts/vision-backup.sh --install-cron
crontab -l
```

Очікується один рядок `*/5 * * * * …/scripts/vision-backup.sh --scheduled … # vision-backup`;
інші рядки crontab на місці.

## Відкат

Лише те, що зробила ця інструкція, і лише на прохання людини:

- розклад: `crontab -e` і видалити рядок, що закінчується на `# vision-backup`;
- підключення Drive: людина натискає **Disconnect** на сторінці Backups;
- локальні бекапи: `rm -rf demo-data/backups` (дампи, які зробив бекап; дані Vision не зачіпає).

Код Vision назад не відкочуємо: оновлення змін схеми бази не несе.

## Звіт людині

Наприкінці (або на зупинці) коротко:

1. До якого кроку дійшов і чи все пройшло, як очікувалось.
2. Цифри з кроку 0: вільне місце, розмір `imageUploads`.
3. Вивід, на якому зупинився, дослівно (без Client secret і токенів: не виводь вміст
   `drive.json` і `rclone.conf`).
4. Скільки тривав перший бекап і розмір `vision-*.tar`.
5. Чи ввімкнено cron.
6. Підтвердження: VRT не зупиняли й не змінювали; `vision-restore.sh` і `demo-clone-from-prod.sh`
   не запускали.
