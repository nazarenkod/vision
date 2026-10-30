# 029 — Задачі

- [x] **T1** (REQ-029-01, 03–07, 09, 13–15) Чисті правила переліку.
  - Файли: `backend/src/projects/allowed-devices.ts`, `allowed-devices.spec.ts`.
  - Готово, коли: усі тести `allowed-devices.spec.ts` з «Перевірки вимог» зелені.
- [x] **T2** (REQ-029-01) Поле `allowedDevices` у налаштуваннях проєкту.
  - Файли: `backend/src/ui-tree/comparison-inputs.ts` (+ `comparison-inputs.spec.ts`, бо парсер
    відкидає невідомі записи), `backend/src/projects/projects.service.ts` (+ spec: 400 на
    недійсному шаблоні, REQ-029-15).
  - Залежить від T1.
- [x] **T3** (REQ-029-05, 10, 12) Перевірка на прийомі знімка.
  - Файли: `backend/src/test-runs/test-runs.controller.ts` (`User-Agent` → `checkDevice`),
    `test-runs.service.ts` (422 до пошуку варіації), їхні spec.
  - Залежить від T1, T2.
- [x] **T4** [P] (REQ-029-11) `GET /projects/:id/devices`.
  - Файли: `backend/src/projects/projects.controller.ts`, `projects.service.ts`,
    `projects.controller.spec.ts`; `docs/architecture/api.md`.
  - Залежить від T2 лише через спільний `projects.service.ts`: робити після T2 або в тому ж заході.
- [x] **T5** [P] (REQ-029-15) Фронтенд: тип, сервіс, хелпер.
  - Файли: `frontend/src/types/project.ts`, `frontend/src/services/projects.service.ts`,
    `frontend/src/_helpers/allowedDevices.helper.ts` (+ `.test.ts`).
  - Готово, коли: `CI=true npx jest allowedDevices` зелений.
- [x] **T6** (REQ-029-02, 11) Розділ «Пристрої» в налаштуваннях.
  - Файли: `frontend/src/components/ProjectForm/AllowedDevicesSettings.tsx`,
    `frontend/src/pages/ProjectSettingsPage.tsx`, `frontend/src/_helpers/projectSettings.helper.ts`
    (розділ, пошук, «змінені розділи»), `frontend/src/i18n/en.ts` + `uk.ts`,
    `frontend/integration_tests/test/projectSettings.spec.ts` (два нові тести, мок `/devices`).
  - Залежить від T4, T5. Скриншот-еталони сторінки налаштувань — оновити в Docker, переглянувши.
- [x] **T7** Документація: статус spec → `Implemented`; словник (`Дозволений пристрій`);
  модуль у `backend/AGENTS.md`; `DEPLOY.md` — як увімкнути перелік (спершу пристрої CI з підказки)
  і як виглядає помилка в тесті; `sdk-java/README.md` — абзац про відмову 422.
- [x] **T8** `/verify`: тести, типи, лінт, еталони скриншотів, `scripts/check-docs.py`, ручна
  перевірка REQ-029-08 (soft assert) — зроблена на jar SDK проти сервера з 422; скриншот-еталон
  `project-settings-page-uk.png` застарів ще до 029 і чекає оновлення в Docker.
