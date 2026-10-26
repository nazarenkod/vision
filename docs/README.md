# Документація Vision

Документація розкривається поступово: спершу коротко, далі — глибше, лише коли це потрібно.

| Рівень | Що | Коли читати |
|---|---|---|
| 0 | [AGENTS.md](../AGENTS.md) і `AGENTS.md` пакетів | завжди: правила, команди, куди далі |
| 1 | цей файл, [огляд продукту](product/overview.md), [словник](product/glossary.md), [архітектура](architecture/overview.md) | щоб зорієнтуватися |
| 2 | [специфікації](specs/README.md), [рішення](decisions/README.md), [модель даних](architecture/data-model.md), [API](architecture/api.md), гайди | коли працюєш з конкретною фічею |

## З чого почати під задачу

| Задача | Читай |
|---|---|
| Нова фіча чи зміна поведінки | [agentic-workflow](guides/agentic-workflow.md) → [шаблон специфікації](specs/_template/spec.md) |
| Доступність, проблеми, дублі багів | [003](specs/003-accessibility-checks/spec.md), [004](specs/004-a11y-problems/spec.md), [ADR-0008](decisions/0008-stable-problem-ids-from-facts.md), [ADR-0009](decisions/0009-jira-mirrors-local-decisions.md) |
| Jira | [005](specs/005-jira-bugs/spec.md), [ADR-0010](decisions/0010-personal-jira-tokens.md) |
| Порівняння мобільних екранів | [002](specs/002-ui-tree-analysis/spec.md), [001](specs/001-check-identity/spec.md) |
| Розгортання, оновлення сервера | [DEPLOY.md](../DEPLOY.md), [011](specs/011-deployment-safety/spec.md), [ADR-0002](decisions/0002-production-is-read-only.md) |
| Підключення автотестів, SDK | [DEPLOY.md §7–8](../DEPLOY.md), [012](specs/012-java-sdk/spec.md) |
| Ручні перевірки | [009](specs/009-manual-checks-cli-mcp/spec.md) |
| Тести і перевірка змін | [testing](guides/testing.md) |
| Як писати документацію | [documentation](guides/documentation.md) |

## Структура

```
docs/
├── product/        що і для кого: огляд, словник
├── architecture/   як влаштовано: компоненти, дані, API
├── specs/          що система повинна робити: одна папка на фічу (spec, plan, tasks)
├── decisions/      чому саме так: ADR, не змінюються після прийняття
└── guides/         як працювати: розробка, тести, агентський цикл, документація
```

Розгортання поруч із продом описано в [DEPLOY.md](../DEPLOY.md) (рос.), демо — у
[DEMO.md](../DEMO.md) (англ.). Обидва файли — для людей, які розгортають і показують Vision.
Інженерні деталі — тут.
