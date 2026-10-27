# 017 — Задачі

- [x] **T1** [P] (REQ-017-02, REQ-017-03, REQ-017-05, REQ-017-20) `drive-auth.ts`: device flow,
  email з `id_token`, `rclone.conf`, налаштування, публічний вигляд без секретів.
  - Готово, коли: `drive-auth.spec.ts` зелений.
- [x] **T2** (REQ-017-01, REQ-017-03, REQ-017-04, REQ-017-06, REQ-017-10, REQ-017-11, REQ-017-12)
  `backups.service.ts`, `backups.controller.ts`: файли, Google, ендпоінти лише для `admin`.
  - Готово, коли: `backups.service.spec.ts`, `backups.controller.spec.ts` зелені; `npm test`, `tsc`, `eslint`.
- [x] **T3** (REQ-017-11, REQ-017-20, REQ-017-21) скрипт: `--scheduled`, замок, `runningSince`,
  remote і кількість копій з `backup-config`, cron кожні 5 хв; compose і `vision.sh` (том, власник).
  - Готово, коли: нові тести в `test_vision_backup.py` зелені, старі теж.
- [x] **T4** (REQ-017-01, REQ-017-05, REQ-017-10, REQ-017-11, REQ-017-20) UI: тип, сервіс,
  `BackupsPage`, пункт меню, посилання зі смуги.
  - Готово, коли: `backups.spec.ts` (Playwright) зелений, `jest`, `tsc` ≤ 25, eslint.
- [x] **T5** Документація: DEPLOY.md (OAuth-клієнт «TVs and Limited Input devices», Internal;
  сторінка Backups; cron), `api.md`, `data-model.md`, AGENTS пакетів, ADR-0013, статус → `Implemented`.
- [ ] **T6** manual: на сервері — підключити Drive кодом, Back up now, бекап у списку; нічний бекап
  за розкладом. Підключення кодом на сервері працює (2026-10-27); бекап і розклад — у процесі.
- [ ] **T7** `/verify`.
