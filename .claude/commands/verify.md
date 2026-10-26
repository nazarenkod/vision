---
description: Перевірка перед «готово» (Verify → Document)
argument-hint: [номер специфікації]
---

Специфікація (якщо є): $ARGUMENTS

1. Подивись `git status` і `git diff --stat`: лише очікувані файли, без переформатування чужого коду.
2. Прожени перевірки зачеплених пакетів (команди — в `AGENTS.md` і `docs/guides/testing.md`):
   - backend: `npm test`, `npx tsc --noEmit -p tsconfig.json`, `npx eslint` по змінених файлах;
   - frontend: `CI=true npx jest`, `npx tsc --noEmit -p .` (не більше 25 помилок), eslint,
     Playwright по зачеплених спеках; якщо змінився знятий екран — еталони в Docker;
   - sdk-java: `gradle test`; CLI: `python3 -I scripts/tests/test_vision_cli.py`.
3. Для специфікації: кожна вимога в «Трасуванні» має зелений тест або виконаний manual-сценарій.
   Онови статус (`Implemented`) і дату.
4. Перевір документацію за таблицею з `docs/guides/documentation.md` («Хто що оновлює») і
   битість посилань скриптом звідти ж.
5. Звітуй правдиво: що пройшло, що впало (з виводом), що не перевірено (наприклад, реальна Jira).
