---
name: verify
description: Check a Vision change before calling it done — tests, types, lint, screenshot baselines, migrations, docs consistency. Use at the end of every implementation task.
argument-hint: [spec number]
---

# Verify → Document

Специфікація (якщо є): $ARGUMENTS

1. `git status`, `git diff --stat`: лише очікувані файли, без переформатованого чужого коду.
2. `python3 -I scripts/verify.py` з кореня — усі перевірки однією командою (~7 хв): unit-тести
   бекенду й фронтенду, функціональні Playwright, `tsc` проти відомих помилок у
   `scripts/baselines/`, eslint по змінених файлах, додавальні міграції (ADR-0003), тести
   скриптів, `check-docs.py`. Поки ітеруєш — `--skip-e2e`; перед «готово» — повний прогін.
   Нова помилка `tsc` — твоя; виправив відому — `--update-baselines`.
3. Змінився знятий екран → еталони в Docker (`docs/guides/testing.md`); `verify.py`
   скриншоти не порівнює. Змінився SDK → `gradle test` (`sdk-java/AGENTS.md`).
4. Специфікація: кожна вимога має рядок у «Перевірка вимог» `design.md` з зеленим тестом або
   виконаним `manual:`; усі задачі в `tasks.md` відмічені; немає `[ПОТРЕБУЄ УТОЧНЕННЯ]` поза
   чеклістом; змінені вимоги старих специфікацій позначені «Замінено/Знято». Лише тоді статус
   `Implemented` і дата. Невиконане — лиши статус і назви у звіті.
5. Документація — за таблицею «Хто що оновлює» з `docs/guides/documentation.md`.
6. Звітуй правдиво: що пройшло, що впало (з виводом), що не перевірено.
