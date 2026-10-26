---
name: verify
description: Check a Vision change before calling it done — tests, types, lint, screenshot baselines, migrations, docs consistency. Use at the end of every implementation task.
argument-hint: [spec number]
---

# Verify → Document

Специфікація (якщо є): $ARGUMENTS

1. `git status`, `git diff --stat`: лише очікувані файли, без переформатованого чужого коду.
2. Перевірки зачеплених пакетів — команди в їхніх `AGENTS.md`:
   - backend: `npm test`, `npx tsc --noEmit -p tsconfig.json`, `npx eslint` по змінених файлах;
   - frontend: `CI=true npx jest`, `npx tsc --noEmit -p .` (≤ 25 помилок), eslint, Playwright по
     зачеплених спеках; змінився знятий екран → еталони в Docker (`docs/guides/testing.md`);
   - sdk-java: `gradle test`; скрипти й CLI: `python3 -I scripts/tests/test_vision_cli.py`,
     `python3 -I scripts/tests/test_agent_guard.py`, `python3 -I scripts/tests/test_check_docs.py`.
3. Нові міграції: `git diff --name-only | grep migration.sql | xargs grep -inE "drop |rename|alter type|set not null"`
   має бути порожнім (ADR-0003).
4. Специфікація: кожна вимога має рядок у «Перевірка вимог» `design.md` з зеленим тестом або
   виконаним `manual:`; статус `Implemented`, дата.
5. Документація — за таблицею «Хто що оновлює» з `docs/guides/documentation.md`;
   `python3 -I scripts/check-docs.py` — без проблем.
6. Звітуй правдиво: що пройшло, що впало (з виводом), що не перевірено.
