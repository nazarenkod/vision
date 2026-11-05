# Перехід на версію для банку

Покрокова інструкція для сервера, де Vision працює поруч із робочим VRT. Переходимо з версії до
[042](../specs/042-project-access/spec.md)–[045](../specs/045-sign-in-and-api-hardening/spec.md)
(SDK 4.3.1-vision.N) на версію з доступом до проєктів, захищеними знімками й зашифрованими секретами
(SDK 1.0.0). Чому так — [план](../security/bank-readiness-plan.md), подробиці кожного кроку —
[DEPLOY.md](../../DEPLOY.md) §4, §7, §11.

## Що з робочим VRT

Як і раніше: **VRT і його база лише читаються**.

- `demo-clone-from-prod.sh` робить `pg_dump` у транзакції лише на читання з найнижчим пріоритетом і
  копіює знімки (або жорсткі посилання, `PROD_IMAGES_MODE=link`). Пише лише в Postgres Vision і в
  `demo-data`, і спершу перевіряє, що контейнер справді Vision
  ([ADR-0002](../decisions/0002-production-is-read-only.md)).
- `vision-check-cutover.sh` робить у VRT лише `SELECT count(*)`.
- `vision-convert-env.py` змінює лише `.env.demo` Vision.
- Шифрування токенів, хеші й анулювання API-ключів, доступ до проєктів — лише в копії, у базі Vision.
  Ключі й токени в самому VRT не змінюються: CI, що ходить у VRT, працює далі.
- Як і раніше, створене лише у Vision замінюється свіжою копією; з налаштованими бекапами скрипт
  спершу робить бекап Vision. Схема VRT новіша, ніж знає Vision, — скрипт зупиняється, нічого не
  скопіювавши.

## Кроки

Усе — з папки Vision на сервері.

1. Зупинити старий Vision:

   ```bash
   ./scripts/vision.sh stop
   ```

2. Забрати код:

   ```bash
   git pull
   ```

3. Перевести налаштування: скрипт покаже зміни без секретів, спитає `yes`, старий файл лишить поруч
   (`.env.demo.before-vision-…`). Замість `jira.bank.example` — хост Jira банку, кілька — через кому:

   ```bash
   python3 -I scripts/vision-convert-env.py --jira-hosts jira.bank.example
   ```

   З'являться `VISION_SECRET_KEY` (**зберегти назавжди**: без нього збережені токени Jira не
   прочитати), `VISION_JIRA_HOSTS`, новий `JWT_SECRET` (усі увійдуть заново); `POSTGRES_DB`
   лишиться попередньою базою.

4. Зібрати образи:

   ```bash
   ./scripts/vision.sh build
   ```

5. Один раз повернути собі файли `demo-data`: API тепер працює не від root.

   ```bash
   docker run --rm --user 0 --entrypoint chown -v "$PWD/demo-data:/data" vision-api -R "$(id -u):$(id -g)" /data/imageUploads /data/backup-config /data/backup-status
   ```

6. Свіжа копія VRT, як завжди:

   ```bash
   ./scripts/demo-clone-from-prod.sh
   ```

7. Запустити. На першому старті: міграції, кожному — доступ до всіх проєктів, токени шифруються,
   API-ключі з копії VRT перестають діяти у Vision.

   ```bash
   ./scripts/vision.sh up -d
   ```

8. Перевірити: API, міграції, кількості рядків проти VRT, анульовані ключі, зашифровані токени.
   Помилка — зупиняється з поясненням.

   ```bash
   ./scripts/vision-check-cutover.sh
   ```

9. Людям:
   - кожен створює новий API-ключ у **Profile → API key** (ключ видно один раз) і прописує його в CI
     (`VISION_APIKEY` або `vision.json`);
   - автотести — на SDK 1.0.0: `./scripts/build-sdk-jar.sh`, далі DEPLOY.md §7;
   - адмін звужує доступ до проєктів у **Settings проєкту → Access**.

## Необов'язково

- LDAP або SSO поряд з локальними акаунтами: `LDAP_*` або `OIDC_*` у `.env.demo` (приклад — у
  `.env.demo.example`), потім `./scripts/vision.sh up -d`.
- Документація API за `<API>/api`: `VISION_SWAGGER=true`.

## Відкат

1. `./scripts/vision.sh stop`.
2. `git checkout` попереднього коміту; старий `.env.demo` — з `.env.demo.before-vision-…`.
3. `./scripts/demo-clone-from-prod.sh`, потім `./scripts/vision.sh up -d --build`.

VRT не змінювався, тож відкат — та сама копія.
