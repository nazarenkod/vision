# Рішення (ADR)

Architecture Decision Record фіксує важливе рішення: контекст, розглянуті варіанти, вибір, його
наслідки та як перевіряємо, що рішення дотримано. Формат — [MADR](https://adr.github.io/madr/).

Коли писати ADR:
- рішення накладає обмеження на майбутню роботу («лише додавальна схема»);
- обрано один з кількох розумних варіантів, і вибір має ціну («особисті токени, а не спільний»);
- інакше доведеться пояснювати те саме в кожному рев'ю.

Правила:
- Прийнятий ADR не переписуємо. Якщо рішення змінилось — новий ADR, а старий отримує статус
  `Superseded by ADR-NNNN`. Дозволено лише виправлення друкарських помилок і посилань.
- Статуси: `Proposed` → `Accepted` → (`Deprecated` | `Superseded by ADR-NNNN`).
- Шаблон — [template.md](template.md). `scripts/check-docs.py` перевіряє статус і розділи.

| ADR | Рішення | Статус | Дата |
|---|---|---|---|
| [ADR-0001](0001-fork-as-subtree-monorepo.md) | Форк як монорепозиторій із git subtree | Accepted | 2026-10-24 |
| [ADR-0002](0002-production-is-read-only.md) | Робочий VRT лише читається | Accepted | 2026-10-24 |
| [ADR-0003](0003-additive-schema-only.md) | Лише додавальні зміни схеми | Accepted | 2026-10-24 |
| [ADR-0004](0004-sdk-upstream-plus-ui-tree.md) | SDK — upstream плюс одне поле | Accepted | 2026-10-25 |
| [ADR-0005](0005-check-by-name-baseline-per-device.md) | Перевірка за назвою, еталон на кожен пристрій | Accepted | 2026-10-25 |
| [ADR-0006](0006-cross-device-is-informational.md) | Порівняння між пристроями — лише довідка | Accepted | 2026-10-25 |
| [ADR-0007](0007-deterministic-first-ai-on-demand.md) | Спершу детермінований аналіз, AI — на вимогу | Accepted | 2026-10-24 |
| [ADR-0008](0008-stable-problem-ids-from-facts.md) | Стабільні ID проблем; ідентичність — з фактів | Accepted | 2026-10-26 |
| [ADR-0009](0009-jira-mirrors-local-decisions.md) | База Vision — джерело правди, Jira — дзеркало | Accepted | 2026-10-26 |
| [ADR-0010](0010-personal-jira-tokens.md) | Особисті токени Jira | Accepted | 2026-10-26 |
| [ADR-0011](0011-screenshot-baselines-in-docker.md) | Скриншот-еталони Playwright — лише з Docker | Accepted | 2026-10-24 |
| [ADR-0012](0012-backups-without-secrets.md) | Бекапи без секретів замість шифрування | Accepted | 2026-10-27 |
| [ADR-0013](0013-ui-drives-host-scripts-through-files.md) | Інтерфейс керує скриптами хоста через файли | Accepted | 2026-10-27 |
| [ADR-0014](0014-undo-through-decision-journal.md) | Undo рішень — через журнал на сервері | Accepted | 2026-10-29 |
| [ADR-0015](0015-theme-tokens-as-css-variables.md) | Кольори — CSS-змінні, рух — токени теми | Accepted | 2026-10-29 |
| [ADR-0017](0017-interface-in-two-languages.md) | Інтерфейс двома мовами через власний словник | Accepted | 2026-10-29 |
