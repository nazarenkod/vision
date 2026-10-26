# 009 — Ручні перевірки: CLI і MCP

- **Статус:** Implemented
- **Оновлено:** 2026-10-27
- **Код:** `frontend/public/cli/vision.py` (один файл, лише стандартна бібліотека Python),
  `frontend/src/components/ManualChecksDialog.tsx` (Help → Manual checks), тести
  `scripts/tests/test_vision_cli.py`

## Проблема

Ручні тестувальники теж хочуть звіряти екран з еталоном і бачити проблеми доступності, але не
пишуть автотестів.

## Вимоги

| ID | Вимога |
|---|---|
| REQ-009-01 | СИСТЕМА ПОВИННА віддавати CLI з UI за адресою `/cli/vision.py`, а Help → Manual checks — показувати команди з ключем користувача. |
| REQ-009-02 | `vision.py config` ПОВИНЕН зберігати URL API, ключ і проєкт; ЯКЩО налаштувань немає, ТО інші команди ПОВИННІ спершу попросити їх. |
| REQ-009-03 | `vision.py check` ПОВИНЕН знімати поточний екран з adb-пристрою (з деревом uiautomator), сесії Appium (Android або iOS), симулятора iOS (лише скриншот) або брати файли, надсилати як перевірку й друкувати результат: статус, змінені елементи, приховані зміни, проблеми доступності, посилання на рев'ю. |
| REQ-009-04 | `vision.py start` / `finish` ПОВИННІ відкривати й закривати сесію, у межах якої перевірки йдуть в одну збірку. |
| REQ-009-05 | `vision.py capture` ПОВИНЕН зберігати екран у файли без надсилання; `devices` — перелічувати adb-пристрої. |
| REQ-009-06 | `vision.py mcp` ПОВИНЕН надавати ті самі дії AI-асистентам як MCP-сервер по stdio. |
| REQ-009-07 | ЯКЩО ключ API невірний, ТО CLI ПОВИНЕН сказати про це зрозуміло. |

## Трасування

| Вимога | Перевірка (`scripts/tests/test_vision_cli.py`) |
|---|---|
| 02 | `test_asks_for_settings_first` |
| 03 | `test_checks_the_screen_of_an_adb_device`, `test_names_the_device_as_configured` |
| 04 | `test_sends_files_into_one_session_build` |
| 05 | `test_saves_a_capture_without_sending` |
| 06 | `test_mcp_server_lists_and_calls_tools` |
| 07 | `test_reports_a_wrong_api_key` |
| 01 | manual: UI → Help → Manual checks |
