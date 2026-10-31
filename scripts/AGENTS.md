# scripts — розгортання і службові скрипти

Загальні правила — у [../AGENTS.md](../AGENTS.md). Ці скрипти запускаються на машині, де
працює робочий VRT, тому помилка тут дорожча, ніж будь-де.

| Скрипт | Що робить |
|---|---|
| `vision.sh` | обгортка над `docker compose` лише для проєкту `vision` (`docker-compose.demo.yml`) |
| `lib/vision-safety.sh` | спільні запобіжники: закріплене ім'я проєкту, перевірка чужих контейнерів, запас диска, підтвердження |
| `demo-clone-from-prod.sh` | лише **читає** прод: `pg_dump` бази й копія або жорсткі посилання на картинки → у Vision |
| `vision-backup.sh` | бекап бази Vision без секретів і картинок у Google Drive (`rclone`); `--scheduled` з cron кожні 5 хв бере час і запити зі сторінки Backups ([013](../docs/specs/013-backups-and-secrets/spec.md), [017](../docs/specs/017-backup-settings-ui/spec.md)) |
| `vision-restore.sh` | відновлення з бекапу, майстер-адміністратор |
| `lib/vision-backup.sh` | спільне для бекапу: секретні колонки, дамп в одному знімку бази |
| `build-sdk-jar.sh` | збирає jar SDK у `dist/sdk-java/` |
| `upload-uitree-samples.py` | надсилає пари PNG + XML з папки як перевірки (для демо без пристрою) |
| `verify.py` | усі перевірки зміни однією командою: unit-тести, Playwright без скриншотів, `tsc` проти `baselines/`, eslint, міграції, тести скриптів, `check-docs.py` — `python3 -I scripts/verify.py` |
| `baselines/*-tsc.txt` | відомі помилки `tsc` upstream; оновлює `verify.py --update-baselines` |
| `check-docs.py` | перевірка документації: посилання, статуси, вимоги ↔ тести, шляхи, ADR — `python3 -I scripts/check-docs.py` |
| `tests/test_vision_cli.py` | тести CLI `frontend/public/cli/vision.py` (фейкові API й adb) |
| `tests/test_agent_guard.py` | тести hook'а `.claude/hooks/guard.py` |
| `tests/test_check_docs.py` | тести `check-docs.py` |
| `tests/test_verify.py` | тести `verify.py`: відомі помилки `tsc`, міграції, змінені файли |
| `tests/test_vision_backup.py` | бекап, відновлення й бекап перед копією проду на локальному Postgres (замінники `docker`, `rclone`) |

Тести запускаються як `python3 -I scripts/tests/<файл>.py`.

## Правила для нових скриптів

- Підключай `lib/vision-safety.sh` і викликай його перевірки до будь-якої дії.
- Ім'я compose-проєкту — лише `vision`, жорстко в коді; `COMPOSE_PROJECT_NAME` з оточення ігноруй.
- До проду — лише читання. Писати можна лише в контейнери й томи, перевірені як власні для Vision.
- Перед записом великих даних перевіряй запас диска (`VISION_DISK_RESERVE_GB`, типово 10 ГБ
  або 5%, що більше).
- Перед руйнівною дією покажи, що саме буде зроблено, і чекай `yes`.
- Bash 3.2 (macOS): без асоціативних масивів; `case` всередині `$( )` не працює, бери `[[ ]]`.

Як перевіряли безпеку проду: [ADR-0002](../docs/decisions/0002-production-is-read-only.md),
[DEPLOY.md §0](../DEPLOY.md).
