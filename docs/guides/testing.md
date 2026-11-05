# Тести і перевірка змін

Інструкція: які є рівні тестів, як писати тести, як оновлювати скриншот-еталони і що перевірити
перед комітом. Точні команди пакетів — у їхніх `AGENTS.md`. Повна перевірка — skill `/verify`, тобто
`python3 -I scripts/verify.py`: усі unit-тести, функціональні Playwright (без скриншотів), `tsc`
проти відомих помилок, eslint по змінених файлах, міграції, тести скриптів і `check-docs.py`
(~7 хв; `--skip-e2e` — без Playwright, ~1,5 хв).

## Рівні

| Рівень | Що перевіряє | Де | Коли |
|---|---|---|---|
| Unit бекенду | чисті функції й сервіси з моками Prisma і `fetch` | `backend/src/**/*.spec.ts`, [backend/AGENTS.md](../../backend/AGENTS.md) | завжди |
| E2E / acceptance бекенду | API з реальною базою | `backend/test/`, `backend/test_acceptance/` | зміни контролерів і схеми; потрібні Postgres і API |
| Контрольний сценарій | увесь робочий шлях на справжньому сервері проти еталона | `backend/test_control/`, `./scripts/control-scenario.sh` | оновлення залежностей, перейменування, зміни доступу; потрібні Docker і Java |
| Unit фронтенду | функції й компоненти | `frontend/src/**/*.test.ts(x)`, [frontend/AGENTS.md](../../frontend/AGENTS.md) | завжди |
| Playwright функціональні | UI з моками API | `frontend/integration_tests/test/` | зміни UI |
| Playwright скриншоти | вигляд сторінок | `toHaveScreenshot` у тих самих спеках | коли змінився знятий екран; лише в Docker |
| SDK | JSON запиту | `sdk-java/src/test/`, [sdk-java/AGENTS.md](../../sdk-java/AGENTS.md) | зміни SDK |
| Скрипти | CLI, hook агента, перевірка документації | `scripts/tests/`, [scripts/AGENTS.md](../../scripts/AGENTS.md) | зміни `vision.py`, `guard.py`, `check-docs.py` |
| Документація | посилання, вимоги ↔ тести, ADR | `python3 -I scripts/check-docs.py` | завжди |
| Стенд | сценарії приймання специфікацій | manual | перед `Verified` |

## Як писати тести

- **Назва тесту — це вимога** як поведінка: «links instead of filing when someone filed the
  problem already». Вона ж стоїть у «Перевірці вимог» `design.md`; `check-docs.py` перевірить, що
  тест із такою назвою існує.
- Перевіряй поведінку, а не реалізацію: що надіслано в Jira, які картки показано, що в базі.
- Фейки замість мережі. Jira — мок `fetch`, що відповідає як Jira Cloud або DC. Prisma — мок із
  потрібною семантикою (унікальний ключ, `updatedAt`).
- Коментар у тесті пояснює, *чому* цей випадок важливий.

## Контрольний сценарій

`./scripts/control-scenario.sh` (~40 с) доводить, що Vision працює так само, як працював:
збирає сервер і SDK з поточного коду, піднімає тимчасовий Postgres у контейнері
`vision-control-pg-*` (без томів, лише на `127.0.0.1`, видаляється після прогону) і проходить
увесь робочий шлях:

1. вхід, акаунти, проєкт з Jira;
2. дві збірки через справжній Java SDK з UI-деревами;
3. review: approve, reject, undo, ignore-areas, правила елементів;
4. доступність і баги в Jira (фейкова Jira записує все, що їй надіслали);
5. посилання на звіт, Insights;
6. CLI і MCP з файлів;
7. знімки і ролі.

Відповіді нормалізуються (id, час, ключі й токени — стабільні мітки) і порівнюються з еталоном у
`backend/test_control/__snapshots__/`. Робоча база й робочий VRT не використовуються.

- Розбіжність — це або регресія, або навмисна зміна поведінки. Навмисну перезаписуй
  `./scripts/control-scenario.sh --update` у тому ж коміті, що й специфікацію, і переглянь diff
  еталона, як код.
- `--images` — те саме проти образів `api` і `migration`, зібраних із цього коду: міграції й seed
  робить образ міграцій, API працює в контейнері від користувача хоста, усе — в окремій мережі
  `vision-control-net-*`, яку скрипт прибирає. Так перевіряється саме те, що піде в контур.
- Один крок: `CONTROL_ONLY=<частина імені файла>`. Лог API після прогону:
  `CONTROL_LOG_DIR=<папка>`.
- Перед зміною, яку він має покрити, проганяй його й до, й після: еталон знято на `main`.

## Скриншот-еталони

Еталони генеруються лише в Docker ([ADR-0011](../decisions/0011-screenshot-baselines-in-docker.md)),
у чистій копії репозиторію, щоб Linux-залежності не потрапили у твій `node_modules`:

```bash
rm -rf /tmp/pwsnap && mkdir -p /tmp/pwsnap
tar --exclude node_modules --exclude test-results -cf - frontend | tar -xf - -C /tmp/pwsnap
cd /tmp/pwsnap/frontend && ./test-docker.sh <spec> --update-snapshots
```

Перед копіюванням нового еталона назад у репозиторій переглянь `test-results/…-actual.png`.
Після локального прогону Playwright поверни `frontend/public/env-config.js` на свій порт API.

## Базові лінії

- `tsc`: відомі помилки успадкованого коду — у `scripts/baselines/{backend,frontend}-tsc.txt`, `verify.py`
  показує лише нові. Нова — твоя; виправив відому — `python3 -I scripts/verify.py --update-baselines`.
- Скриншот-тести поза Docker падають завжди (macOS, хмарна сесія), тому `verify.py` запускає
  Playwright з `--ignore-snapshots`. Функціональні мусять проходити.
- У хмарній сесії hook `.claude/hooks/session-start.sh` ставить `node_modules` і задає
  `PLAYWRIGHT_CHROMIUM_EXECUTABLE` — вбудований Chromium образу (`playwright install` не потрібен).

## Перед комітом

- [ ] `python3 -I scripts/verify.py` — зелений.
- [ ] Тести зміненого модуля зелені; нові вимоги мають тести й рядок у «Перевірці вимог».
- [ ] Unit-тести бекенду й фронтенду зелені повністю.
- [ ] Типи й лінт без нових помилок; `git status` не показує чужих файлів.
- [ ] Змінився знятий екран — еталони з Docker.
- [ ] Міграції додавальні; `npx prisma generate` виконано; фікстури доповнено.
- [ ] `python3 -I scripts/check-docs.py` — без проблем.
