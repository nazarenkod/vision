# 013 — Задачі

- [x] **T1** (REQ-013-14, REQ-013-19, REQ-013-05) `scripts/lib/vision-backup.sh`: перелік
  секретних колонок, дамп у знімку (FIFO-сесія + `pg_dump --snapshot` + `COPY` без секретів),
  tar з `manifest.txt`.
  - Файли: `scripts/lib/vision-backup.sh`, `scripts/tests/test_vision_backup.py` (замінники `docker`, `rclone`).
  - Готово, коли: «leaves passwords and Jira tokens out of the backup» і «refuses when the database container is not Vision's» зелені.
- [x] **T2** (REQ-013-01, REQ-013-03, REQ-013-11, REQ-013-13) `scripts/vision-backup.sh`: передача
  в Drive, 7 дампів, картинки лише нові, локальні незавершені, `status.json`, `--install-cron`.
  - Готово, коли: тести передачі, зберігання, повтору й cron зелені.
- [x] **T3** (REQ-013-10, REQ-013-15, REQ-013-17, REQ-013-19, REQ-013-20) `scripts/vision-restore.sh`:
  майстер-логін з `.env.demo` або запит, довжина пароля, план і `yes`, відновлення секціями,
  майстер-адміністратор, звірка з manifest.
  - Готово, коли: тести відновлення, майстра, API-ключів і короткого пароля зелені.
- [x] **T4** (REQ-013-12) `demo-clone-from-prod.sh`: бекап перед заміною непорожньої бази; збій
  бекапу — нічого не замінюється.
- [x] **T5** [P] (REQ-013-09) `backend/src/backups/`: `backupWarning`, `GET /backups/status` для
  `admin`; compose: том і `BACKUP_STATUS_FILE`.
  - Готово, коли: `backup-status.spec.ts` зелений, `npm test`, `tsc`, `eslint` чисті.
- [x] **T6** [P] (REQ-013-17, REQ-013-18) `PUT /users/:id/password` для `admin`; тест, що
  заглушка пароля не приймається.
- [x] **T7** (REQ-013-09, REQ-013-18) UI: `BackupWarning` для адміністраторів, «Set password» у
  списку користувачів (`data-testid`), тип і метод у сервісі.
- [x] **T8** Документація: DEPLOY.md (налаштування `rclone` для Google Drive, cron, відновлення,
  майстер-логін), `.env.demo.example`, `scripts/AGENTS.md`, ADR-0012 → `Accepted` після згоди,
  статус spec → `Implemented`.
- [ ] **T9** manual: на стенді — бекап у справжній спільний диск Google Drive (сервісний акаунт), відновлення на чистій машині за
  ≤ 4 год, вхід майстром, автотест з колишнім `VRT_APIKEY` проходить.
- [ ] **T10** `/verify`.
