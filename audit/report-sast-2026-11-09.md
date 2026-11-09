# Vision — SAST-аудит перед перенесенням у банківський контур

**Конфіденційно** · коміт `fe7a82c` + виправлення з розділу 2 · 2026-11-09 · третя ітерація

## 1. Резюме

**Вердикт: код готовий до SAST-сканування банку.** Статичний аналіз поточного дерева не
знаходить жодної підтвердженої вразливості:

| Перевірка | Результат |
|---|---|
| Вразливі залежності (`npm audit`, prod і dev, 3 пакети) | **0** у всіх шести прогонах |
| SAST TypeScript/JavaScript/React/Java/Python/Dockerfile/bash (semgrep, 1081 правило, 980 файлів) | **0** підтверджених знахідок; 1311 спрацювань розібрано вручну (розділ 3) |
| SAST Python — CLI і скрипти (bandit) | **0** High; Medium — лише хибні або в тестах |
| Shell-скрипти (shellcheck) | **0** проблем безпеки |
| Секрети в дереві (detect-secrets + правила секретів semgrep) | **0** справжніх секретів; усі спрацювання — заглушки, моки й тестові дані |
| SQL-ін'єкції, XSS, `eval`, командні ін'єкції (ручна перевірка) | не знайдено: Prisma лише параметризованими шаблонами, `dangerouslySetInnerHTML`/`eval`/`child_process` у коді продукту немає |

Порівняно з першим аудитом (2026-11-05) закрито всі блокери: масове присвоєння (VIS-SEC-001),
DoS через знімки й дерева (005, 014, 043, 045), ReDoS (015 — правила тепер на RE2 з лінійним
часом), SSRF/витік токена Jira (008, 048), слабкі секрети підпису (002), сесії без відкликання
(009), login CSRF (018). Додано CSP і HSTS (011). У межах цього аудиту виправлено ще дві
знахідки, які видно в SAST (розділ 2).

Знахідки, які власник свідомо відклав чи прийняв у попередніх ітераціях (`findings.json`,
статуси `not_fixed`, `accepted_risk`, `partially_fixed`), у цей аудит не входять, як і мінорні
стильові зауваження.

## 2. Виправлено в цьому аудиті

| Що бачив сканер | Де | Знахідка | Виправлення |
|---|---|---|---|
| `gcm-no-tag-length` (semgrep **ERROR**; у Sonar/Checkmarx — «weak crypto»): AES-GCM розшифровує й укорочений тег автентифікації (4–16 байт), тож підробити запис простіше | `backend/src/shared/secret-box.ts` | частина VIS-SEC-024 | `createDecipheriv(..., { authTagLength: 16 })`. Збережені секрети мають 16-байтовий тег, тож уже зашифровані токени Jira й ключі Gemini читаються як і раніше. Тест: значення з тегом, обрізаним до 4 байт, не розшифровується. |
| Фільтр LDAP складено через `replaceAll` з рядком заміни: `$&`, `` $` ``, `$'` в email читалися як шаблони й змінювали фільтр в обхід екранування | `backend/src/users/ldap/ldapusers.service.ts` | VIS-SEC-050 | `split('{{email}}').join(email)`: email потрапляє у фільтр лише в екранованому вигляді. Тест: для email з `$&`, `` $` ``, `$'` фільтр містить рівно цей email. |

Нові тести спершу падали на старому коді (4 з 4), а з виправленням проходять. Повторний прогін
semgrep по обох файлах дає 0 спрацювань.

## 3. Розбір спрацювань semgrep (1311)

Спрацювань рівня ERROR у виводі semgrep — 4, і всі хибні: `useless-ternary` у
`backups.service.ts` (`secret ? 0o600 : 0o644` — різні права файла) і три
`dangerous-subprocess-use-audit` у CLI та службових скриптах (аргументи передаються списком,
без shell, а команди задано в коді).

| Група | К-сть | Висновок |
|---|---:|---|
| Стиль і i18n: `i18next-key-format`, `jsx-not-internationalized`, `react-props-spreading`, `missing-template-string-indicator`, `no-stringify-keys`, `useless-ternary`, `useless-cat`, `string-concat-in-list`, `mui-snackbar-message` | 1109 | не безпека; ключі словника — свідомий формат проєкту (ADR-0017) |
| `package-dependencies-check` — діапазони версій у `package.json` | 86 | FP: є lock-файли з `integrity`, образи збираються `npm ci` |
| bash `unquoted-variable-expansion` (INFO) | 39 | не експлуатується: змінні — внутрішні шляхи й порти; частина — сторонні `gradlew`, `wait-for-it.sh` |
| `path-join-resolve-traversal`, `detect-non-literal-fs-filename` | 32 | FP: 26 — тести й тестовий стенд; `hdd.service.ts` перевіряє вихід за теку знімків (`getImagePath`, з тестом); `backups.service.ts` бере лише сталі імена `FILES.*` |
| `generic-api-key` | 15 | FP: тестові дані й приклади в README |
| `detect-non-literal-regexp` | 6 | FP на сервері: `linear-regex.ts` лише перевіряє синтаксис, а виконує RE2 з лінійним часом. У браузері (3) — підрахунок збігів у вікні людини, яка сама задала вираз; на інших не впливає |
| `dynamic-urllib-use-detected`, `dangerous-subprocess-use-audit` | 8 | FP: CLI і службові скрипти; адреса — з локальної конфігурації людини, `subprocess` — списком аргументів без shell |
| `missing-image-version` | 4 | FP: базові образи задано через `ARG` з тегом **і digest** `sha256` |
| `html-in-template-string`, `unsafe-dynamic-method` | 6 | тести й скрипт збірки іконки |
| `no-replaceall` (`vite.config.ts`, правило сумісності зі старими браузерами), `avoid-platform-with-from`, `remove-package-cache` | 4 | не безпека: конфіг збірки на Node 24; збірка на `BUILDPLATFORM` свідома; apt-кеш видаляється |
| `github-actions-mutable-action-tag` | 2 | поза скоупом: CI не використовується й не входить у поставку |

## 4. Bandit і shellcheck

- **bandit** (3305 рядків Python): 73 спрацювання, High — 0. 53 — у `scripts/tests/`.
  `B608` (SQL з рядків) у `seed-insights-demo.py` — FP: кожен ідентифікатор перевіряється
  регуляркою UUID до вставки (`seed-insights-demo.py:165`), а скрипт — лише для демо.
  `B310` у CLI — схема URL із власного конфігу людини.
- **shellcheck** (рівень warning+): 7, з них 0 щодо безпеки (`SC2148` для бібліотек, що
  підключаються через `source`; `SC2155`, `SC2010` — стиль).

## 5. Ручна перевірка того, що змінилось з 2026-11-07

Переглянуто дифф `a3b6104..fe7a82c` у `backend/src`, `frontend/src`, `frontend/nginx`, Dockerfile-и:
сесії в базі з `sid` у токені та закриттям сокетів (052), `nonce` для SSO у `sessionStorage`,
CSP (`default-src 'self'; script-src 'self'; frame-ancestors 'none'; object-src 'none'`) в nginx
і API, HSTS по https, RE2 для виразів правил, ліміти PNG за кожним IHDR, клієнт Jira без
переадресацій. Нових проблем рівня Medium і вище не знайдено.

## 6. Інструменти й обмеження

semgrep 1.184.0 з офіційним репозиторієм правил `semgrep-rules` (коміт `16b9e6d`; набори
javascript, typescript, java, python, dockerfile, bash, yaml, html, json, generic/secrets —
надмножина `p/owasp-top-ten`, `p/nodejs`, `p/typescript`, `p/react`, `p/secrets`), офлайн, без
метрик · bandit 1.9.4 · shellcheck 0.11.0 · detect-secrets · npm audit. Сирі виводи —
`audit/raw/*-2026-11-09.json` (semgrep — після виправлень).

Обмеження: середовище не дозволило завантажити бінарники hadolint, trivy, gitleaks,
osv-scanner. Їх замінили правила dockerfile/secrets у semgrep, detect-secrets і ручна
перевірка Dockerfile-ів (non-root `USER`, образи за digest). Результати trivy/osv від
2026-11-05 (0 CVE) лишаються чинними для залежностей, бо `npm audit` дає ті самі 0. Історія git,
транзитивні залежності Gradle і `trivy image` не перевірялись — як і в попередніх ітераціях.
Банк може використовувати інший SAST (SonarQube, Checkmarx, Fortify): правила там інші, але
класи проблем ті самі, тож очікувано чистий результат.
