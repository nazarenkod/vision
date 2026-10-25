# Развёртывание Vision рядом с продовым VRT

Vision ставится на ту же машину, что и работающий VRT, и работает на **копии** его базы и
картинок. Прод только читается (`pg_dump` и копирование файлов), в него ничего не пишется.
У Vision свои порты, свой Postgres, своя папка картинок и свой compose-проект `vision`.

Проверено на стенде: upstream VRT 5.6.3 (postgres:12, migration 5.4.0) → скрипт копирования →
`docker compose up --build` → вход продовыми пользователями, старые сборки и картинки на месте,
приём старых прогонов, новые проверки из Java SDK и CLI, повторное копирование поверх работающего
Vision, перезапуски.

## 1. Что нужно на машине

- Docker с Compose v2 (`docker compose version`).
- git (или архив проекта), bash, rsync.
- Свободное место: около 4 ГБ на образы. Картинки копируются жёсткими ссылками, если папка
  прода на том же диске: тогда места почти не нужно. Иначе копируются целиком.
- Свободные порты (по умолчанию): 18080 (UI), 14200 (API), 15432 (Postgres, только localhost).
- Доступ к базе прода: имя её Docker-контейнера на этой машине **или** строка подключения.
- Путь к папке картинок прода (её `imageUploads`). Если прод хранит картинки в S3, см. раздел 8.

Версия прода должна быть VRT 5.x и не новее форка. Скрипт проверит обе вещи сам.

## 2. Код

```bash
git clone <адрес репозитория с форком> vision
```

```bash
cd vision && git checkout mvp/demo
```

## 3. Настройка

```bash
cp .env.demo.example .env.demo
```

В `.env.demo` обязательно:

| Переменная | Что указать |
|---|---|
| `JWT_SECRET` | любой длинный секрет. Если взять тот же, что у прода, у пользователей будут работать уже выданные токены входа |
| `DEMO_UI_URL` | адрес UI так, как его видит браузер, например `http://vision-host:18080` |
| `DEMO_API_URL` | адрес API так, как его видит браузер, например `http://vision-host:14200` |
| `PROD_PG_CONTAINER` | имя контейнера Postgres прода (`docker ps`), **или** |
| `PROD_DATABASE_URL` | строка подключения к базе прода, доступная с этой машины |
| `PROD_IMAGES_DIR` | папка картинок прода (то, что смонтировано в его API как `/imageUploads`) |

Порты меняются через `DEMO_UI_PORT`, `DEMO_API_PORT`, `DEMO_POSTGRES_PORT`. AI по умолчанию
выключен (`AI_PROVIDER=none`), см. раздел 7.

## 4. Копия данных прода

```bash
./scripts/demo-clone-from-prod.sh
```

Что делает скрипт:
1. поднимает Postgres Vision;
2. делает `pg_dump` базы прода (только чтение);
3. останавливает API Vision, если он запущен, очищает его базу и восстанавливает в неё дамп;
4. проверяет, что прод — VRT 5.x и что в нём нет миграций, которых форк не знает;
5. копирует картинки (жёсткие ссылки или rsync).

Скрипт можно запускать повторно, чтобы взять свежие данные: всё, что было сделано в Vision,
заменится текущим состоянием прода.

Если скрипт остановился:
- **«production VRT is older than 5.x»**: прод нужно сначала обновить, или запускать Vision
  на пустой базе (пропустить этот шаг).
- **«Production has migrations this fork does not know»**: прод новее форка. Нужно подтянуть
  upstream в форк (`git subtree pull`) и запустить скрипт снова.

## 5. Запуск

```bash
docker compose -f docker-compose.demo.yml --env-file .env.demo up -d --build
```

Первая сборка идёт несколько минут. Проверка:

```bash
docker compose -f docker-compose.demo.yml --env-file .env.demo ps -a
```

Должно быть: `migration` в состоянии **Exited (0)**, `api`, `ui` и `postgres` в состоянии **Up**.

```bash
curl -s http://localhost:14200/health
```

Ответ `{"status":"ok",...}`. Миграции видно в логах:

```bash
docker compose -f docker-compose.demo.yml --env-file .env.demo logs migration
```

В конце должно быть `All migrations have been successfully applied` (при повторных запусках
`No pending migrations to apply`).

Дальше открыть `DEMO_UI_URL` и войти **продовой** учёткой: пользователи, пароли, проекты,
сборки и API-ключи скопированы. Админ по умолчанию не создаётся, если в копии есть активный админ.

## 6. Первые шаги в Vision

- **Эталонное устройство** (для справочного сравнения устройств): Projects → карандаш у проекта
  → блок «Mobile screenshots» → Reference device. Например, эмулятор.
- **Jira**: там же, URL и токен. Для Jira Cloud ещё email.
- **Автотесты**: в SDK указать адрес API Vision (`DEMO_API_URL`) и тот же API-ключ. Чтобы
  включить проверки по дереву элементов, в Java/Kotlin добавить
  `.uiTree(driver.getPageSource())` в `TestRunOptions`. Это единственное изменение SDK, и
  оно необязательное: без него всё работает как раньше.
- **Ручные тестировщики**: меню «?» → «Manual checks (CLI)». Там три готовые команды с ключом
  пользователя. Для отправки экранов нужна роль editor или admin.

## 7. AI (необязательно)

В `.env.demo`: `AI_PROVIDER=gemini` и `GEMINI_API_KEY=...`, либо `AI_PROVIDER=ollama`,
`AI_MODEL=gemma3:4b` и Ollama на хосте (`OLLAMA_BASE_URL=http://host.docker.internal:11434`).
Применить:

```bash
docker compose -f docker-compose.demo.yml --env-file .env.demo up -d api
```

## 8. Если прод хранит картинки в S3

Скрипт копирует только папку. Для S3 скопируйте бакет прода в отдельный бакет (например
`aws s3 sync`), а API Vision настройте на него теми же переменными, что у прода
(`AWS_S3_BUCKET_NAME` и другие), добавив их в сервис `api` в `docker-compose.demo.yml`.
Никогда не указывайте Vision бакет прода: Vision удаляет старые картинки при очистке.

## 9. Обновление

```bash
git pull
```

```bash
docker compose -f docker-compose.demo.yml --env-file .env.demo up -d --build
```

Новые миграции применятся сами при старте. Данные остаются.

## 10. Если что-то пошло не так

| Симптом | Что смотреть |
|---|---|
| `migration` в состоянии Exited (1) | `docker compose … logs migration`. Чаще всего база недоступна или прод новее форка |
| UI открывается, но вход не работает | `DEMO_API_URL` должен открываться из браузера; `docker compose … logs api` |
| У старых прогонов нет картинок | `PROD_IMAGES_DIR` указывал не туда: исправить и запустить скрипт копирования снова |
| Порт занят | поменять `DEMO_*_PORT` в `.env.demo` |
| Не хватает места | `docker system df`, затем `docker builder prune` |

## 11. Удаление

```bash
docker compose -f docker-compose.demo.yml --env-file .env.demo down
```

```bash
rm -rf demo-data
```

Прод это не затрагивает.
