# 051 — Задачі

- [x] **T0** Порожня конфігурація порівняння: тест на поточну поведінку повної конфігурації, потім
  типові значення для відсутніх ключів (баг, не вимога 051).
  - Файли: `backend/src/compare/libs/{pixelmatch,looks-same,odiff}/*.service.ts` і їхні тести.
  - Готово, коли: `"{}"` дає `threshold: 0.1`, повна конфігурація — як раніше.
- [x] **T1** [P] (REQ-051-01…04) Перевірка секретів і документація.
  - Файли: `backend/src/shared/server-secrets.ts`, `main.ts`, `DEPLOY.md`,
    `docs/guides/development.md`, `.env.demo.example`, `backend/.env.example`,
    `scripts/control-scenario.sh`.
  - Готово, коли: тести `server-secrets.spec.ts` зелені, тести скриптів зелені.
- [x] **T2** [P] (REQ-051-05…08) Jira: правила адреси, переадресація, перевірка проєкту.
  - Спершу тести на поточну поведінку для https-адрес на дозволених хостах.
  - Файли: `backend/src/a11y/jira-hosts.ts`, `jira.client.ts`, `projects.controller.ts`.
  - Готово, коли: тести з «Перевірки вимог» зелені, наявні тести Jira не змінились.
- [x] **T3** [P] (REQ-051-09, 14) Ліміт областей ігнорування на бекенді й в інтерфейсі.
  - Файли: DTO областей, `test-runs.service.ts`, `TestDetailsModal.tsx`, i18n.
  - Готово, коли: 21 область — 400 на кожному маршруті, 20 — як раніше; в інтерфейсі — повідомлення
    з лімітом, області на місці.
- [x] **T4** (REQ-051-10…13) Лінійні вирази.
  - Спершу диференційний тест `RegExp` проти нового рушія на корпусі виразів і текстів (на старому
    коді — еталон).
  - Файли: `backend/src/ui-tree/linear-regex.ts`, `comparison-inputs.ts`, `variable-text.ts`,
    `ui-tree.service.ts`, `frontend/src/types/insights.ts`, `WhatsCompared.tsx`, i18n.
  - Готово, коли: диференційний тест і знімки поведінки зелені; `(a+)+$` на 2000 символах < 50 мс.
- [x] **T5** Документація: статус spec → `Implemented`, рядки «Замінено» в [044](../044-secrets-at-rest/spec.md)
  REQ-044-03 і REQ-044-07, `backend/AGENTS.md`, `audit/PROGRESS.md`.
- [x] **T6** `/verify` і стенд: відтворення VIS-SEC-002/005/008/015 до й після.
