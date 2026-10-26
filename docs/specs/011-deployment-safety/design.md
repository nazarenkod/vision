# 011 — Дизайн

## Підхід

Усі запобіжники — в одній бібліотеці `scripts/lib/vision-safety.sh`, яку підключає кожен
скрипт. `vision.sh` — обгортка над `docker compose -p vision -f docker-compose.demo.yml`, що
спершу перевіряє мітки compose всіх контейнерів проєкту. Копіювання (`demo-clone-from-prod.sh`)
читає прод `pg_dump` і копією або жорсткими посиланнями файлів; пише лише в перевірені власні
контейнери й томи. Міграції на копію застосовує сервіс `migration` під час `up`.

## Компоненти

| Компонент | Шлях | Роль |
|---|---|---|
| Запобіжники | `scripts/lib/vision-safety.sh` | закріплений проєкт, перевірка чужих контейнерів, запас диска, підтвердження |
| Compose | `scripts/vision.sh`, `docker-compose.demo.yml` | єдиний вхід; ліміти ресурсів; сервіс `migration` |
| Копія проду | `scripts/demo-clone-from-prod.sh` | лише читання проду; перевірка версії (`20230730154101_init`) |
| Налаштування | `.env.demo.example` | порти, ліміти, `VISION_DISK_RESERVE_GB`, джерело копії |
| Хук агента | `.claude/hooks/guard.py` | блокує `docker compose` поза `vision.sh` і пуш не в `vision` ([agentic-workflow](../../guides/agentic-workflow.md)) |

## Перевірка вимог

Автоматичних тестів запобіжників поки немає. Перевірено вручну 2026-10-24 на стенді з upstream
VRT 5.6.3 на postgres:12. «Відбиток» проду — хеші вмісту всіх таблиць і всіх картинок, час старту
контейнерів — знято до і після кожного з кроків: відмови запобіжників (чужий проєкт `vision`,
чужа `COMPOSE_PROJECT_NAME`), два копіювання (копія й посилання), збирання, запуск, перевірки
з SDK і CLI, прийом прогонів і видалення збірок. Відбитки збіглися повністю.

| Вимога | Перевірка |
|---|---|
| REQ-011-01 | manual: `COMPOSE_PROJECT_NAME=prod ./scripts/vision.sh ps` працює з проєктом `vision` |
| REQ-011-02 | manual: контейнер з міткою проєкту `vision` з іншого compose-файлу → відмова |
| REQ-011-03 | manual: відбиток проду до й після копіювання |
| REQ-011-04 | manual: відбиток; підміна контейнера бази → відмова |
| REQ-011-09 | manual: `PROD_PG_CONTAINER` = контейнер Vision → відмова |
| REQ-011-05 | manual: `VISION_DISK_RESERVE_GB` більший за вільне місце → відмова |
| REQ-011-06 | manual: `docker stats` під час прогону |
| REQ-011-07 | manual: відповідь не `yes` → нічого не змінено |
| REQ-011-08 | manual: копія без міграції `20230730154101_init` → зупинка з порадою |
| REQ-011-10 | manual: `./scripts/vision.sh logs migration` після `up` |
| REQ-011-11 | manual: `PROD_IMAGES_MODE=link` при `demo-data` на іншому диску → зупинка |
