# Тести і перевірка змін

Інструкція: які є рівні тестів, як писати тести, як оновлювати скриншот-еталони і що перевірити
перед комітом. Точні команди пакетів — у їхніх `AGENTS.md`. Повна перевірка — skill `/verify`.

## Рівні

| Рівень | Що перевіряє | Де | Коли |
|---|---|---|---|
| Unit бекенду | чисті функції й сервіси з моками Prisma і `fetch` | `backend/src/**/*.spec.ts`, [backend/AGENTS.md](../../backend/AGENTS.md) | завжди |
| E2E / acceptance бекенду | API з реальною базою | `backend/test/`, `backend/test_acceptance/` | зміни контролерів і схеми; потрібні Postgres і API |
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

## Скриншот-еталони

Еталони генеруються лише в Docker ([ADR-0011](../decisions/0011-screenshot-baselines-in-docker.md)),
у чистій копії репозиторію, щоб Linux-залежності не потрапили у твій `node_modules`:

```bash
rsync -a --delete --exclude node_modules --exclude test-results frontend/ /tmp/pwsnap/frontend/
cd /tmp/pwsnap/frontend && ./test-docker.sh <spec> --update-snapshots
```

Перед копіюванням нового еталона назад у репозиторій переглянь `test-results/…-actual.png`.
Після локального прогону Playwright поверни `frontend/public/env-config.js` на свій порт API.

## Базові лінії

- `frontend`: `tsc` — 25 відомих помилок upstream. Нова — твоя.
- `backend`: помилки `tsc` у `prisma/test/seed.spec.ts` — upstream.
- Скриншот-тести на macOS падають завжди. Функціональні мусять проходити.

## Перед комітом

- [ ] Тести зміненого модуля зелені; нові вимоги мають тести й рядок у «Перевірці вимог».
- [ ] Unit-тести бекенду й фронтенду зелені повністю.
- [ ] Типи й лінт без нових помилок; `git status` не показує чужих файлів.
- [ ] Змінився знятий екран — еталони з Docker.
- [ ] Міграції додавальні; `npx prisma generate` виконано; фікстури доповнено.
- [ ] `python3 -I scripts/check-docs.py` — без проблем.
