@AGENTS.md

## Для Claude Code

- Інструкції пакета підтягуються з його `CLAUDE.md` (він імпортує `AGENTS.md` пакета), щойно ти
  відкриваєш файл у `backend/`, `frontend/`, `sdk-java/` або `scripts/`.
- Skills циклу: `/spec`, `/design`, `/verify` (`.claude/skills/`).
- `.claude/hooks/guard.py` (PreToolUse для Bash) блокує порушення непорушних правил. Якщо він
  щось заблокував, не обходь його, а скажи людині, що й навіщо хотів зробити.
- Тимчасові файли пиши в scratchpad сесії, а не в репозиторій.
