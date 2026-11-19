# 082 — Дизайн

## Підхід

Пробний прогін (semgrep з правилами спільноти, bandit, `npm audit`, ручний пошук шаблонів
Fortify) дав перелік місць. Кожне закривається невеликою зміною, а тест-запобіжник у
`scripts/tests/` не дає шаблонам повернутись.

- **Перший адміністратор (US-1).** `backend/prisma/seed.ts` не має запасного пароля.
  - Чиста `defaultPasswordProblem(password)` повертає причину відмови: порожньо або коротше за
    12 символів. Довжина та сама, що `MIN_PASSWORD_LENGTH` у `src/users/account.ts` (045), але
    продубльована: образ міграцій збирається лише з `backend/prisma`, без `src`.
  - Перевірка йде лише тоді, коли адміністратора треба створити. На відмову seed пише причину в
    `stderr` і ставить `process.exitCode = 1`: `entrypoint.sh` працює з `set -e`, тож контейнер
    міграцій завершується з помилкою, а compose не запускає API (`service_completed_successfully`).
    Проєкт за замовчуванням створюється незалежно.
  - Вивід: email адміністратора без пароля; про проєкти — лише кількість.
  - `docker-compose.demo.yml` передає `${DEFAULT_USER_PASSWORD:-}` без `123456`; не `:?`, бо
    compose тоді не запустився б і на базі з адміністраторами (копія проду).
  - Приклади `.env.demo.example`, `backend/.env.example` і документація (README, DEPLOY,
    `docs/admin/configuration.md`, `docs/security/overview.md`) — без типового пароля.
  - Acceptance-тест бере пароль адміністратора лише з `DEFAULT_USER_PASSWORD`.
- **Хеші (US-2).** `createHash('sha1')` → `createHash('sha256')` у чотирьох місцях з тим самим
  обрізанням. Формат кодів (`a11y-` + 8 hex) і ID груп не змінюється.
  - `problemCode` дає код лише новій проблемі. Збережені проблеми й зв'язані з ними баги Jira
    несуть код із бази (`deciding?.code`, `codeOn(issue)`), тож REQ-082-07 тримається без міграції.
  - Відбитки областей у `TestRun.componentChanges` порівнюються лише в межах збірки; одноразовий
    розкол групи у збірці, що йде під час оновлення, прийнято (граничний випадок у spec).
- **Обробка помилок (US-2).** `MixedGuard` — через `passes(check)`: виняток guard-а означає
  `false`, і йде наступний спосіб входу; поведінка та сама. У CLI три `except: pass` явно ставлять
  значення за замовчуванням, а невдалий `chmod` файла з ключем пише попередження в `stderr`.

## Перевірка вимог

| Вимога | Перевірка |
|---|---|
| REQ-082-01 | `backend/prisma/test/seed.spec.ts › creates no admin and fails the seed when DEFAULT_USER_PASSWORD %s` |
| REQ-082-02 | `backend/prisma/test/seed.spec.ts › creates no admin and fails the seed when DEFAULT_USER_PASSWORD %s` |
| REQ-082-03 | `backend/prisma/test/seed.spec.ts › needs no password when an active admin exists already` |
| REQ-082-04 | `backend/prisma/test/seed.spec.ts › never prints the admin password or project rows` |
| REQ-082-05 | `scripts/tests/test_scanner_findings.py › test_has_no_fallback_password` |
| REQ-082-06 | `scripts/tests/test_scanner_findings.py › test_uses_no_sha1_or_md5` |
| REQ-082-07 | `backend/src/a11y/a11y-issues.spec.ts › keeps ids and bugs of problems decided under another grouping` |
| REQ-082-08 | `scripts/tests/test_scanner_findings.py › test_leaves_no_catch_block_empty`, `backend/src/auth/guards/mixed.guard.spec.ts › tries the API key when the sign-in check refuses with an exception` |
| REQ-082-09 | `scripts/tests/test_vision_cli.py › test_warns_when_the_settings_file_cannot_be_made_private` |

## Ризики

- Хто розгортає порожній Vision за старою інструкцією без пароля, побачить зупинену міграцію.
  Повідомлення називає змінну й довжину, README і DEPLOY кажуть про неї в першому кроці.
- Тест-запобіжник — регулярні вирази, а не розбір коду: порожній `catch` з коментарем усередині
  він не бачить. Цього досить, щоб не повернути виправлене; повну картину дає сам Fortify.
