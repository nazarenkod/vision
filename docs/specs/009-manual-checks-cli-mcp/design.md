# 009 — Дизайн

## Підхід

Один файл Python без залежностей (лише стандартна бібліотека), який віддає сам UI, тож
тестувальнику нічого не треба встановлювати, крім Python. CLI використовує той самий
`POST /test-runs`, що й SDK, і читає результат аналізу з API. Режим `mcp` — MCP-сервер по stdio з
тими самими діями.

## Компоненти

| Компонент | Шлях | Роль |
|---|---|---|
| CLI | `frontend/public/cli/vision.py` | `config`, `check`, `capture`, `devices`, `start`, `finish`, `mcp` |
| Довідка | `frontend/src/components/ManualChecksDialog.tsx` | Help → Manual checks: команди з ключем |
| Тести | `scripts/tests/test_vision_cli.py` | фейковий API і фейковий `adb` у PATH |

## Перевірка вимог

| Вимога | Перевірка |
|---|---|
| REQ-009-01 | manual: UI → Help → Manual checks показує `config` з ключем і посилання на `/cli/vision.py` |
| REQ-009-02 | `scripts/tests/test_vision_cli.py › test_asks_for_settings_first` |
| REQ-009-08 | `scripts/tests/test_vision_cli.py › test_asks_for_settings_first` |
| REQ-009-03 | `scripts/tests/test_vision_cli.py › test_checks_the_screen_of_an_adb_device`; `scripts/tests/test_vision_cli.py › test_names_the_device_as_configured` |
| REQ-009-09 | `scripts/tests/test_vision_cli.py › test_checks_the_screen_of_an_adb_device` |
| REQ-009-04 | `scripts/tests/test_vision_cli.py › test_sends_files_into_one_session_build` |
| REQ-009-05 | `scripts/tests/test_vision_cli.py › test_saves_a_capture_without_sending` |
| REQ-009-06 | `scripts/tests/test_vision_cli.py › test_mcp_server_lists_and_calls_tools` |
| REQ-009-07 | `scripts/tests/test_vision_cli.py › test_reports_a_wrong_api_key` |
