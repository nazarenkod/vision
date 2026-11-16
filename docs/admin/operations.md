# Експлуатація

Інструкція для адміністратора, що супроводжує Vision: щоденні дії, моніторинг, оновлення,
бекапи, секрети, користувачі, інциденти. Перше розгортання — у [DEPLOY.md](../../DEPLOY.md), усі
змінні — у [довіднику налаштувань](configuration.md).

Усі команди — з папки Vision на сервері, від користувача, якому належить `demo-data/` і який
має доступ до `docker`. **Docker compose — лише через `./scripts/vision.sh`**: він закріплює
назву проєкту `vision` і нічого не робить, якщо поруч є чужі контейнери з тією самою назвою
([ADR-0002](../decisions/0002-production-is-read-only.md)).

## Щоденне

| Дія | Команда |
|---|---|
| Стан контейнерів | `./scripts/vision.sh ps -a` — `api`, `ui`, `postgres` у `Up`, `migration` — `Exited (0)` |
| Здоров'я API | `curl -s http://localhost:14200/health` → `{"status":"ok",…}` (перевіряє й базу) |
| Логи | `./scripts/vision.sh logs --tail 200 api` (також `ui`, `migration`, `postgres`) |
| Зупинити / запустити | `./scripts/vision.sh stop` / `./scripts/vision.sh up -d` |
| Перезапустити API | `./scripts/vision.sh restart api` |
| Місце | `du -sh demo-data/*`, `docker system df` |

## Моніторинг

| Що | Як | Тривога |
|---|---|---|
| Доступність | HTTP-перевірка `GET <DEMO_API_URL>/health` і `GET <DEMO_UI_URL>/` із системи моніторингу | не `200` двічі поспіль |
| Контейнери | `docker inspect -f '{{.State.Status}} {{.RestartCount}}' vision-api-1` | не `running` або зростає `RestartCount` |
| Диск | вільне місце на томі з `demo-data/` і `/var/lib/docker` | менше 15 % |
| Бекапи | `demo-data/backup-status/status.json`, сторінка **Backups**; адміністратори бачать попередження, якщо успішному бекапу понад 26 год | попередження або помилка в `demo-data/backups/cron.log` |
| Пам'ять API | `docker stats --no-stream` | постійно близько до `DEMO_API_MEMORY` |

Логи контейнерів пише Docker. Типовий драйвер `json-file` їх не обертає: задайте в
`/etc/docker/daemon.json` `"log-opts": {"max-size": "50m", "max-file": "5"}` або передавайте їх у
систему збору логів (драйвер `syslog`, `fluentd`, `gelf`). У логах API немає паролів, токенів і
рядків `User`; помилки повертаються клієнту без stack trace.

## Зміна налаштувань

1. Змінити `.env.demo`.
2. `./scripts/vision.sh up -d` — перестворюються лише контейнери, налаштування яких змінились.

Адреси (`DEMO_UI_URL`, `DEMO_API_URL`) потрапляють в інтерфейс і CSP при старті контейнера `ui`;
після їх зміни — `./scripts/vision.sh up -d --force-recreate ui api`.

## Оновлення версії

1. Прочитати [CHANGELOG](../../CHANGELOG.md): чи немає ручних кроків.
2. Бекап: `./scripts/vision-backup.sh` (або **Backups → Back up now**).
3. `git pull`.
4. `./scripts/vision.sh up -d --build` — нові образи, міграції застосуються самі. Міграції лише
   додавальні ([ADR-0003](../decisions/0003-additive-schema-only.md)), тож стара версія працює на
   новій схемі.
5. Перевірити `ps -a`, `/health`, `logs migration` (у кінці — `All migrations have been successfully applied`).

**Відкат:** `git checkout <попередній тег або коміт>` і `./scripts/vision.sh up -d --build`. Дані
лишаються. Якщо треба повернути й дані — [відновлення з бекапу](#відновлення).

Збирати бажано не в пік: збирання кілька хвилин навантажує CPU.

## Бекапи

Що потрапляє в бекап: дамп бази Vision без паролів, токенів Jira і ключів Gemini (API-ключі —
хешами) і знімки. Щоночі за розкладом, з cron раз на 5 хвилин перевіряється, чи пора.

Налаштувати один раз:

```bash
./scripts/vision-backup.sh --install-cron
```

Куди: `BACKUP_REMOTE` — будь-який remote rclone. **Рекомендовано — внутрішнє S3-сумісне сховище**
(MinIO, Ceph, NetApp StorageGRID): налаштувати remote `rclone config` у `RCLONE_CONFIG_DIR` і вказати
`BACKUP_REMOTE=s3:vision-backups`. Або Google Drive зі сторінки **Backups**.
Без remote бекапи лишаються локально в `demo-data/backups` — цього недостатньо: диск той самий.

Перевіряти відновлення регулярно, раз на квартал: [backup-trial](../guides/backup-trial.md).

### Відновлення

```bash
./scripts/vision-restore.sh                                # останній бекап
./scripts/vision-restore.sh vision-20261027T031700Z.tar    # конкретний
```

Скрипт показує план і чекає `yes`. Після відновлення входять мастер-логіном (`VISION_MASTER_EMAIL`),
він стає адміністратором; іншим людям адмін задає пароль (**Users → Set password**) або вони
входять через LDAP/SSO; токени Jira кожен вводить заново; API-ключі й автотести працюють як були.
Повністю, з чистою машиною, — [DEPLOY.md §12](../../DEPLOY.md#12-бекапи).

## Секрети

| Секрет | Де | Ротація |
|---|---|---|
| `JWT_SECRET` | `.env.demo` | замінити й `up -d`: усі входи завершуються, люди входять заново; API-ключі діють |
| `VISION_SECRET_KEY` | `.env.demo` | **не ротується без втрат**: зашифровані токени Jira і ключі Gemini перестають читатися (люди вводять їх знову), підписані посилання на знімки змінюються. Тримати копію у сховищі секретів |
| `POSTGRES_PASSWORD` | `.env.demo` і сам Postgres | `ALTER USER postgres PASSWORD '…'` через `./scripts/vision.sh exec postgres psql -U postgres`, потім нове значення в `.env.demo` і `up -d` |
| `LDAP_BIND_PASSWORD`, `OIDC_CLIENT_SECRET` | `.env.demo` | за політикою компанії; `up -d` |
| API-ключі людей | у базі лише SHA-256 | кожен створює новий у **Profile → API key**; старий перестає діяти одразу |
| Токени Jira | у базі зашифровані | кожен у профілі |

## Користувачі й доступ

| Роль | Що може |
|---|---|
| `admin` | усе: усі проєкти, користувачі, доступ до проєктів, бекапи, налаштування |
| `editor` | рев'ю в проєктах, до яких має доступ: приймати й відхиляти, правила, баги в Jira; створювати проєкти |
| `guest` | лише перегляд проєктів, до яких має доступ |

- Акаунти створює адміністратор (**Users → New user**) або перший вхід через LDAP/SSO
  ([035](../specs/035-admin-accounts/spec.md)). Самореєстрації немає.
- Доступ до проєкту: **Settings проєкту → Access** ([042](../specs/042-project-access/spec.md)).
  Новий користувач не бачить жодного проєкту, доки не дадуть доступ; editor бачить створені ним.
- Звільнення: видалити користувача в **Users** — його входи й API-ключ перестають діяти з
  наступного запиту. З LDAP/SSO заблокувати людину ще й у каталозі, інакше перший вхід створить
  акаунт знову. Пароль, змінений адміністратором, завершує всі входи людини
  ([052](../specs/052-sessions-and-browser-hardening/spec.md)).
- Із SSO роль адміністратора дає лише група з `OIDC_ADMIN_VALUES`.

## Типові проблеми

| Симптом | Причина й дія |
|---|---|
| `api` перезапускається, у лозі `JWT_SECRET …` або `VISION_SECRET_KEY …` | секрет не заданий, короткий або з прикладу: виправити `.env.demo` |
| `migration` — `Exited (1)` | `./scripts/vision.sh logs migration`; найчастіше база недоступна або місце закінчилось |
| Інтерфейс відкривається, але вхід не працює | `DEMO_API_URL` не відкривається з браузера або CORS: адреса в `DEMO_UI_URL` має точно збігатися з тією, що в браузері |
| Немає оновлень наживо | проксі не пропускає WebSocket `/socket.io` |
| Знімки не показуються | змінився `VISION_SECRET_KEY` або адреса API; перезавантажити сторінку |
| SDK отримує `403 No access to this project` | власнику API-ключа не дали доступу до проєкту |
| SDK отримує `422` | пристрою немає в переліку дозволених пристроїв проєкту ([029](../specs/029-allowed-devices/spec.md)) |
| Jira: «Jira at … is not allowed» | хост Jira не в `VISION_JIRA_HOSTS` |
| `Not enough disk …` | звільнити місце (`docker builder prune`, старі бекапи) |

Більше — [DEPLOY.md §13](../../DEPLOY.md#13-якщо-щось-пішло-не-так).

## Видалення

`./scripts/vision.sh down`, потім `rm -rf demo-data` (дані й бекапи на цьому сервері). Робочий VRT
це не зачіпає.
