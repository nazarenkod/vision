# 057 — Дизайн

## Підхід

Лише тексти інтерфейсу: у словниках `en.ts` і `uk.ts` кожен текст, де «екран» / «screen»
означає результат перевірки, переписано на «перевірка» / «check» (REQ-057-01…03), а де
зображення — на «знімок» / «screenshot» (REQ-057-04). Ключі словників, ідентифікатори
(`TestRun`, `scope: "screen"`, `screen-search`) і API не змінюються: перейменування лише для
людей, тож запити SDK і посилання лишаються ті самі.

Буквальні значення (REQ-057-05) — перелік ключів у тесті словників. Новий текст зі словом
«екран» / «screen» поза переліком валить тест, тож термін не повернеться непомітно. Перелік
також не тримає ключів, які слово вже не містять.

Щоб не було двох «Перевірок» поруч, колонка кількості прогонів в Insights (поруч із колонкою
«Перевірка») зветься «Прогони» / «Runs»; лічильник доступності — «Перевірок з UI-деревом» /
«Checks with a UI tree». Англійські підтвердження масових дій уже кажуть «items» і лишаються.

Тексти бекенду для Jira-бага доступності («Екран: …») — це заголовок екрана застосунку з
UI-дерева (ID екрана), тобто буквальне значення: не змінюються. Звіт збірки й баг із порівняння
беруть тексти зі словників (REQ-057-06).

## Компоненти

| Компонент | Шлях | Роль |
|---|---|---|
| Словники | `frontend/src/i18n/en.ts`, `frontend/src/i18n/uk.ts` | ~150 текстів кожною мовою; множина за формами мови |
| Тест словників | `frontend/src/i18n/checkNotScreen.test.ts` | перелік буквальних «екранів», вкладка й область правила, множина |
| Тести з текстами | `frontend/src/**/*.test.ts(x)`, `frontend/integration_tests/test/*.spec.ts` | нові підписи |
| Словник термінів | `docs/product/glossary.md`, `docs/specs/023-ukrainian-ui/design.md` | «перевірка» замість «екран» |

## Дані

Без змін.

## Ризики

| Ризик | Що робимо |
|---|---|
| Паралельна гілка додає текст зі старим «екран» | тест словників упаде після злиття й назве ключ |
| «Перевірка» ще й назва + теги (001): вкладка рахує пристрої окремо | пристрій видно тегом у рядку (037); записано в словнику |
| Скриншот-еталони Playwright з текстами | оновлюються в Docker (`./test-docker.sh --update-snapshots`) |

## Перевірка вимог

| Вимога | Перевірка |
|---|---|
| REQ-057-01 | `frontend/integration_tests/test/language.spec.ts › names the build tab All checks in both languages` |
| REQ-057-02 | `frontend/src/i18n/checkNotScreen.test.ts › counts checks by the plural forms of each language` |
| REQ-057-03 | `frontend/src/i18n/checkNotScreen.test.ts › names the build tab and the rule scope a check in both languages` |
| REQ-057-04 | `frontend/src/_helpers/whatsCompared.helper.test.ts › says the whole screenshot is compared when neither side has a tree` |
| REQ-057-05 | `frontend/src/i18n/checkNotScreen.test.ts › says screen only for the device's or the app's screen` |
| REQ-057-06 | `frontend/src/components/BuildReport/ReportDocument.test.tsx › summary names the project, build, branch, time, devices and numbers` |
