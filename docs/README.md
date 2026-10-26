# Документація Vision

Документація розкривається поступово: спершу коротко, далі глибше, і лише тоді, коли це
потрібно. Що на якому рівні й як писати нове — у [documentation](guides/documentation.md).

| Рівень | Що | Коли читати |
|---|---|---|
| 0 | [AGENTS.md](../AGENTS.md) і `AGENTS.md` пакетів | завжди: правила, команди, куди далі |
| 1 | цей файл, [огляд продукту](product/overview.md), [словник](product/glossary.md), [архітектура](architecture/overview.md) | щоб зорієнтуватися |
| 2 | [специфікації](specs/README.md), [рішення](decisions/README.md), [дані](architecture/data-model.md), [API](architecture/api.md), гайди | коли працюєш з конкретною темою |

## З чого почати під задачу

| Задача | Читай |
|---|---|
| Нова фіча чи зміна поведінки | [agentic-workflow](guides/agentic-workflow.md) → `/spec` |
| Доступність, проблеми, дублі багів | [003](specs/003-accessibility-checks/spec.md), [004](specs/004-a11y-problems/spec.md), [ADR-0008](decisions/0008-stable-problem-ids-from-facts.md), [ADR-0009](decisions/0009-jira-mirrors-local-decisions.md) |
| Jira | [005](specs/005-jira-bugs/spec.md), [ADR-0010](decisions/0010-personal-jira-tokens.md) |
| Порівняння мобільних екранів | [002](specs/002-ui-tree-analysis/spec.md), [001](specs/001-check-identity/spec.md) |
| Розгортання й оновлення сервера | [DEPLOY.md](../DEPLOY.md), [011](specs/011-deployment-safety/spec.md), [ADR-0002](decisions/0002-production-is-read-only.md) |
| Підключення автотестів, SDK | [DEPLOY.md §7–8](../DEPLOY.md), [012](specs/012-java-sdk/spec.md) |
| Ручні перевірки | [009](specs/009-manual-checks-cli-mcp/spec.md) |
| Локальний запуск | [development](guides/development.md) |
| Тести й перевірка змін | [testing](guides/testing.md) |

## Будова

Розділи відповідають типам документації [Diátaxis](https://diataxis.fr/): кожен документ —
одного типу, і читач знає, чого від нього чекати.

| Папка | Тип | Що там |
|---|---|---|
| `product/` | пояснення, довідка | що і для кого; терміни |
| `architecture/` | пояснення, довідка | як влаштовано; дані; API |
| `specs/` | довідка (контракт) | що система повинна робити: `spec.md`, як зроблено й чим перевірено: `design.md`, кроки: `tasks.md` |
| `decisions/` | пояснення | чому саме так (ADR) |
| `guides/` | інструкції (how-to) | як запустити, перевірити, працювати агентом, писати документацію |

[DEPLOY.md](../DEPLOY.md) (рос.) — інструкція для того, хто розгортає Vision поруч із продом;
[DEMO.md](../DEMO.md) (англ.) — для показу. Інженерні деталі — тут.

Документація перевіряється: `python3 -I scripts/check-docs.py` (локально, у `/verify` і в CI).
