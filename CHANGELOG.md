# Зміни

Що змінилось у кожній поставці з погляду користувача й адміністратора, і що треба зробити руками
при оновленні. Подробиці кожного пункту — у специфікації за номером ([docs/specs](docs/specs/README.md)).

## Vision 1.0 (2026-11)

Версії складових: API `backend` 1.1.0, інтерфейс `frontend` 1.6.0, Java SDK `ua.vision:vision-sdk`
1.0.0, Playwright SDK `@vision/sdk-playwright` 1.0.0.

### Рев'ю знімків

- Порівняння з урахуванням UI-дерева: правила елементів, системні бари, зсуви, приховані зміни,
  «порівнювати лише» обрані елементи, нестабільний текст регулярним виразом, безіменні елементи
  через XPath ([002](docs/specs/002-ui-tree-analysis/spec.md), [015](docs/specs/015-compare-selected-elements/spec.md),
  [024](docs/specs/024-elements-instead-of-areas/spec.md), [027](docs/specs/027-nameless-elements/spec.md),
  [033](docs/specs/033-variable-text/spec.md)).
- Групи змін: одне рішення на багато знімків, підказки щодо шуму, Undo рішення
  ([006](docs/specs/006-change-groups/spec.md), [018](docs/specs/018-ui-redesign/spec.md)).
- Огляд збірки, звіт і публічне посилання на нього ([031](docs/specs/031-build-overview/spec.md),
  [048](docs/specs/048-overview-checks-table/spec.md)).
- Веб як джерело UI-дерева: Selenide і Playwright ([050](docs/specs/050-web-ui-tree/spec.md)).
- Бета: пошук екранів за UI-деревом і рев'ю за елементом на всіх екранах збірки
  ([053](docs/specs/053-screen-search/spec.md), [055](docs/specs/055-bulk-decisions-by-query/spec.md)).

### Доступність і Jira

- Перевірки доступності з нормами проєкту; стабільні ID проблем без дублів між екранами й людьми
  ([003](docs/specs/003-accessibility-checks/spec.md), [004](docs/specs/004-a11y-problems/spec.md),
  [026](docs/specs/026-a11y-rules-settings/spec.md)).
- Баги в Jira особистим токеном, зі скриншотом і шаблоном опису ([005](docs/specs/005-jira-bugs/spec.md),
  [025](docs/specs/025-bug-from-comparison/spec.md)).

### Для команд

- Insights: застарілі еталони, нестабільні екрани, доступність ([008](docs/specs/008-insights/spec.md)).
- Ручні перевірки з CLI і MCP ([009](docs/specs/009-manual-checks-cli-mcp/spec.md)).
- AI лише на вимогу, з денним лімітом ([010](docs/specs/010-ai-assist/spec.md)).
- Інтерфейс англійською й українською ([023](docs/specs/023-ukrainian-ui/spec.md)).

### Безпека

- Доступ до проєктів: кожен бачить лише свої, адмін — усе ([042](docs/specs/042-project-access/spec.md)).
- Знімки лише з входом або за підписаним посиланням ([043](docs/specs/043-protected-images/spec.md)).
- Токени Jira і ключі Gemini зашифровані, API-ключі — хешем, Jira — лише на дозволені хости
  ([044](docs/specs/044-secrets-at-rest/spec.md)).
- LDAP або SSO поруч із локальними акаунтами, обмеження спроб входу, заголовки безпеки, CORS, Swagger
  за прапорцем ([045](docs/specs/045-sign-in-and-api-hardening/spec.md)).
- Сеанси анулюються на сервері, CSP ([051](docs/specs/051-security-quick-fixes/spec.md),
  [052](docs/specs/052-sessions-and-browser-hardening/spec.md)).
- Образи без root, за digest, з перевіркою TLS; Node 24, Postgres 16; `npm audit` — 0
  ([звіт аудиту](audit/security-audit-2026-11.md)).
- `REACT_APP_OIDC_AUTO_REDIRECT` з `.env.demo` тепер доходить до інтерфейсу.

### Що зробити при оновленні з попередньої версії

Перехід зі старішого Vision (SDK 4.3.1-vision.N) — за [інструкцією переходу](docs/guides/upgrade-to-1.0.md):

- конвертувати налаштування (`scripts/vision-convert-env.py`): з'являться `VISION_SECRET_KEY`,
  `VISION_JIRA_HOSTS`, новий `JWT_SECRET`;
- усі входять заново, кожен створює новий API-ключ і прописує його в CI;
- автотести — на SDK 1.0.0 (`ua.vision:vision-sdk`, пакет `ua.vision.sdk`);
- адмін звужує доступ до проєктів.
