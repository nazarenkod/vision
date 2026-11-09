# Vision — SAST-аудит перед перенесенням у банківський контур

**Конфіденційно** · коміт `fe7a82c` (main після специфікацій 051 і 052) · 2026-11-09 · третя ітерація

## 1. Резюме

**Вердикт: код готовий до SAST-сканування банку.** На поточному дереві немає жодної
підтвердженої вразливості рівня Critical, High чи Medium, яку знаходить статичний аналіз:

| Перевірка | Результат |
|---|---|
| Вразливі залежності (`npm audit`, prod і dev, 3 пакети) | **0** у всіх шести прогонах |
| SAST TypeScript/JavaScript/React/Java/Python/Dockerfile/bash (semgrep, 1081 правило, 980 файлів) | **0** нових підтверджених знахідок; 1313 спрацювань розібрано вручну (розділ 3) |
| SAST Python — CLI і скрипти (bandit) | **0** High; Medium — лише хибні або в тестах |
| Shell-скрипти (shellcheck) | **0** проблем безпеки |
| Секрети в дереві (detect-secrets + правила секретів semgrep) | **0** справжніх секретів; усі спрацювання — заглушки, моки й тестові дані |
| SQL-ін'єкції, XSS, `eval`, командні ін'єкції (ручна перевірка) | не знайдено: Prisma лише параметризованими шаблонами, `dangerouslySetInnerHTML`/`eval`/`child_process` у коді продукту немає |

Порівняно з першим аудитом (2026-11-05) закрито всі блокери: масове присвоєння (VIS-SEC-001),
DoS через знімки й дерева (005, 014, 043, 045), ReDoS (015 — правила тепер на RE2 з лінійним
часом), SSRF/витік токена Jira (008, 048), слабкі секрети підпису (002), сесії без відкликання
(009), login CSRF (018). Додано CSP і HSTS (011).

Знахідки, які власник свідомо відклав чи прийняв у попередніх ітераціях (див. `findings.json`,
статуси `not_fixed`, `accepted_risk`, `partially_fixed`), у цей аудит не входять, як і мінорні
стильові зауваження.

**Одне застереження для проходження SAST-воріт банку** — розділ 2: три спрацювання сканера
стосуються вже відомих відкладених знахідок і будуть видимі у звіті будь-якого SAST-інструмента.
Їх треба або виправити (разом ≈ 30 хв), або подати з обґрунтуванням як прийняті.

## 2. Що побачить SAST банку і що з цим робити

Це не нові проблеми, а відкладені знахідки, у яких є «гучний» для сканера вигляд. Якщо в банку
ворота за правилом «0 ERROR / 0 High», вони заблокують прийняття.

| Спрацювання | Рівень у сканері | Де | Відома знахідка | Рекомендація |
|---|---|---|---|---|
| `gcm-no-tag-length` — AES-GCM розшифрування без `authTagLength` | **ERROR** (semgrep), аналог є в Sonar/Checkmarx | `backend/src/shared/secret-box.ts:34` | частина VIS-SEC-024 (Low) | **Виправити**: `createDecipheriv('aes-256-gcm', key, iv, { authTagLength: 16 })`. Одна строка, формат збережених секретів не змінюється. Без цього практично будь-який SAST-інструмент покаже Critical/High-категорію «weak crypto». |
| `no-replaceall` — `replaceAll` у фільтрі LDAP | WARNING | `backend/src/users/ldap/ldapusers.service.ts:83` | VIS-SEC-050 (Low) | Бажано виправити: функція заміни `() => value` замість рядка; інакше сканери на кшталт Checkmarx позначать «LDAP Injection». |
| `github-actions-mutable-action-tag` | WARNING | `.github/workflows/docs.yml:12-13` | VIS-SEC-030 (Low) | CI у контур не йде (експорт без історії й без GitHub). Достатньо пояснення; або закріпити дві дії за SHA. |

Якщо виправляти не хочеться — для semgrep можна поставити `// nosemgrep: <правило>` з коментарем
«чому», але банкові ІБ зазвичай приймають це гірше, ніж виправлення.

## 3. Розбір спрацювань semgrep (1313)

| Група | К-сть | Висновок |
|---|---:|---|
| Стиль і i18n: `i18next-key-format`, `jsx-not-internationalized`, `react-props-spreading`, `missing-template-string-indicator`, `no-stringify-keys`, `useless-ternary`, `useless-cat`, `string-concat-in-list`, `mui-snackbar-message` | 1109 | не безпека; ключі словника — свідомий формат проєкту (ADR-0017) |
| `package-dependencies-check` — діапазони версій у `package.json` | 86 | FP: є lock-файли з `integrity`, образи збираються `npm ci` |
| bash `unquoted-variable-expansion` (INFO) | 39 | не експлуатується: змінні — внутрішні шляхи й порти; частина — сторонні `gradlew`, `wait-for-it.sh` |
| `path-join-resolve-traversal`, `detect-non-literal-fs-filename` | 32 | FP: 26 — тести й тестовий стенд; `hdd.service.ts` перевіряє вихід за теку знімків (`getImagePath`, з тестом); `backups.service.ts` бере лише сталі імена `FILES.*` |
| `generic-api-key` | 15 | FP: тестові дані й приклади в README |
| `detect-non-literal-regexp` | 6 | FP на сервері: `linear-regex.ts` лише перевіряє синтаксис, а виконує RE2 з лінійним часом (VIS-SEC-015 закрито). У браузері (3) — підрахунок збігів у вікні людини, яка сама задала вираз; на інших не впливає |
| `dynamic-urllib-use-detected`, `dangerous-subprocess-use-audit` | 8 | FP: CLI і службові скрипти; адреса — з локальної конфігурації людини, `subprocess` — списком аргументів без shell |
| `missing-image-version` | 4 | FP: базові образи задано через `ARG` з тегом **і digest** `sha256` |
| `html-in-template-string`, `unsafe-dynamic-method` | 6 | тести й скрипт збірки іконки |
| `no-replaceall` (`vite.config.ts`), `avoid-platform-with-from`, `remove-package-cache` | 4 | FP / свідомо: збірка на `BUILDPLATFORM`, apt-кеш видаляється |
| Розділ 2 | 4 | див. вище |

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
метрик · bandit 1.9.4 · shellcheck 0.11.0 · detect-secrets · npm audit (Node 22 / npm з
середовища). Сирі виводи — `audit/raw/*-2026-11-09.json`.

Обмеження: середовище не дозволило завантажити бінарники hadolint, trivy, gitleaks,
osv-scanner. Їх замінили правила dockerfile/secrets у semgrep, detect-secrets і ручна
перевірка Dockerfile-ів (non-root `USER`, образи за digest). Результати trivy/osv від
2026-11-05 (0 CVE) лишаються чинними для залежностей, бо `npm audit` дає ті самі 0. Історія git,
транзитивні залежності Gradle і `trivy image` не перевірялись — як і в попередніх ітераціях.
Банк може використовувати інший SAST (SonarQube, Checkmarx, Fortify): правила там інші, але
класи проблем ті самі, тож після виправлень розділу 2 очікувано чистий результат.
