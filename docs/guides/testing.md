# Тести і перевірка змін

## Рівні

| Рівень | Що | Команда | Коли |
|---|---|---|---|
| Unit бекенду | чисті функції й сервіси з моками Prisma і `fetch` (`src/**/*.spec.ts`) | `cd backend && npm test` | завжди |
| E2E / acceptance бекенду | API з реальною базою (`test/`, `test_acceptance/`) | `npm run test:e2e`, `npm run test:acceptance` | зміни контролерів і схеми; потрібні Postgres і API |
| Unit фронтенду | Jest (`src/**/*.test.ts(x)`) | `cd frontend && CI=true npx jest` | завжди |
| Playwright функціональні | UI з моками API (`integration_tests/test`) | `npx playwright test <spec>` | зміни UI |
| Playwright скриншоти | `toHaveScreenshot` | `./test-docker.sh` (Linux) | коли змінився знятий екран |
| SDK | TestNG + `MockHttpClient` | `cd sdk-java && gradle test` | зміни SDK |
| CLI | unittest з фейковим API і adb | `python3 -I scripts/tests/test_vision_cli.py` | зміни `vision.py` |
| Стенд | сценарії з «Критеріїв приймання» специфікацій | manual | перед `Verified` |

## Як писати тести

- **Назва тесту — це вимога**, сформульована як поведінка: «links instead of filing when
  someone filed the problem already». Її посилання стоїть у розділі «Трасування» специфікації.
- Перевіряй поведінку, а не реалізацію: що надіслано в Jira, які картки показано, що в базі.
- Фейки, а не мережа. Jira — це `fetch`-мок, що відповідає як Jira (Cloud або DC). Prisma — мок із
  реальною семантикою там, де вона важлива: унікальний ключ, `updatedAt`.
- Коментар у тесті пояснює, *чому* цей випадок важливий.

## Playwright і скриншоти

- Скриншот-тести на macOS не збігаються ніколи ([ADR-0011](../decisions/0011-screenshot-baselines-in-docker.md)).
- Еталони генеруємо в чистій копії репозиторію, щоб Linux-залежності не потрапили у твій
  `node_modules`:
  ```bash
  rsync -a --delete --exclude node_modules --exclude test-results frontend/ /tmp/pwsnap/frontend/
  cd /tmp/pwsnap/frontend && ./test-docker.sh --update-snapshots
  cp integration_tests/test/<spec>-snapshots/<file>.png <репозиторій>/frontend/integration_tests/test/<spec>-snapshots/
  ```
- Перед заміною еталона переглянь `test-results/…-actual.png`.
- Після локального прогону поверни `frontend/public/env-config.js` на свій порт API.

## Базові лінії

- `frontend`: `tsc` — 25 відомих помилок upstream. Нова помилка — твоя.
- `backend`: помилки `tsc` у `prisma/test/seed.spec.ts` — upstream.

## Перед комітом

- [ ] Тести зміненого модуля зелені; нові вимоги мають тести (і рядок у «Трасуванні»).
- [ ] `npm test` у backend і `CI=true npx jest` у frontend — зелені повністю.
- [ ] Типи й лінт без нових помилок.
- [ ] `prettier` по змінених файлах; `git status` не показує чужих файлів.
- [ ] Якщо змінився знятий екран — еталони з Docker.
- [ ] Міграція додавальна; `npx prisma generate` виконано; фікстури доповнено.
- [ ] Документацію оновлено ([documentation.md](documentation.md)).
