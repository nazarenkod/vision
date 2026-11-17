# 074 — Дизайн

## Підхід

Лише фронтенд: бекенд уже віддає все потрібне (`StructureInfo`, правила з `check` і `parts`,
`testRun.diffPercent`). Рішення, що й коли показувати, — чисті функції в хелперах із jest-тестами;
компоненти лише малюють.

- **Порядок вкладки** (`InsightsPanel.changesTab`): рядок проблеми (якщо є) → баги цієї
  перевірки → підказки → «Зміни» (або картка «Змінився майже весь екран») → зсуви → блок
  правил `WhatsCompared`. Блок правил переїжджає вниз, бо на макеті зміни йдуть першими.
- **Заголовок результату** (`ComparisonVerdict`) показуємо, лише коли він щось пояснює: є
  причина (проблема «порівнювати лише», немає дерева, рішення без змін) або тон `failed`.
  «N змін» і «Змін немає» більше не показуються (REQ-074-01, 02) — рішення `showVerdict()`.
  Для нестабільного тексту заголовок один — «Нестабільний текст змінив вигляд», без причини;
  зниклий елемент лишає свій заголовок, теж без причини (REQ-074-13).
- **Рядки змін**: підзаголовок «Зміни» стилем груп `WhatsCompared`; перед назвою — квадратик
  за `changeMark(row, invisible)`: `invisible` (синій пунктир), `loose` (рожевий пунктир, без
  елемента), `visible` (рожевий суцільний). Смужка `invisibleStrip` і значок `invisibleMark`
  зникають (REQ-074-03).
- **Зміна тексту одним рядком**: `inlineDiff(before, after)` у `wordDiff.helper` зливає обидві
  сторони в одну послідовність: спільні слова, зняті слова (`del`, сірі закреслені) одразу перед
  доданими (`ins`, зелені). `BeforeAfter` малює її одним рядком (REQ-074-04).
- **Блок правил** (`WhatsCompared`) без кнопки, заголовка й підсумку: сітка `схема | групи`.
  Схема (`ComparedMap`) — у рамці `tokens.border` замість кольору бренду. Групи завжди відкриті;
  «Не впливають» теж показано одразу, приглушено, пояснення — у підказці заголовка (REQ-074-05,
  06).
- **Зони ігнорування**: група «Не враховується» → «Зони ігнорування»; рядки ділить
  `ignoreZoneGroups(rows)` на «Передано з тесту» (`test`, `testSetting`), «Для всього проєкту»
  (`project`, `projectSetting`) і «Додано вручну» (`screen`, `drawn`), порожні групи не
  показуються. Чип джерела прибрано з усіх рядків блоку (REQ-074-07, 08, 11).
- **Нестабільний текст**: `variableShown(rule, baselineText)` у `variableText.helper` повертає
  сегменти поточного тексту, для кожного місця — значення еталона, якщо воно інше. Значення
  еталона беремо з тексту елемента еталона з тим самим селектором, коли він один; інакше — зі
  збереженого в правилі значення (`sample`). Рядок: закреслене старе → нове фіолетовим, у кінці
  ✓ (`CheckRounded`, `tokens.status.passed.fg`) з підказкою «Відповідає правилу». Невдалий —
  рядок на `status.failed.bg`, значення червоним, під ним «очікувалось «…»» або «елемента немає
  на знімку». Блок `variableProblem` (підказка й «Прибрати правило») видалено (REQ-074-10…14).
- **Меню ⋯ правила нестабільного тексту** (лише `canEdit`): «Змінити правило» — новий проп
  `onEditRule(rule)`, модалка обирає елемент правила на поточному знімку (як клік по ньому, специфікація
  033), і відкривається його попап з правилом; «Показати на знімку» — `onPinMark(key)`;
  «Прибрати правило» — наявний `onRemove` з Undo (REQ-074-15).
- **«Завести баг»** (`TestDetailsModal`) показується завжди. Без адреси Jira — неактивна з
  підказкою `reportBug.noJira`. Виділення червоним — `bugStandsOut({ failed, diffPercent })`
  (REQ-074-20, 21). `failed` модалка бере з тих самих даних, що й заголовок результату: проблеми
  «порівнювати лише» й нестабільного тексту зі `structure`.
- **Картка «Змінився майже весь екран»**: `mostOfScreen(diffPercent, changes)` — правда, коли
  змін, що рахуються, більше нуля й `diffPercent > 25`. Картка показує `Math.round(diffPercent)`
  %, «Змінився майже весь екран», «N змін · показати всі»; «показати всі» вмикає перелік до зміни
  перевірки (стан скидається за `testRun.id`) (REQ-074-30, 31).

## Компоненти

| Компонент | Шлях | Роль |
|---|---|---|
| `inlineDiff` | `frontend/src/_helpers/wordDiff.helper.ts` | зміна тексту однією послідовністю слів |
| `showVerdict`, `verdict` (нестабільний текст), `changeMark`, `ignoreZoneGroups`, `mostOfScreen`, `bugStandsOut`, `MOST_OF_SCREEN` | `frontend/src/_helpers/whatsCompared.helper.ts` | що показувати |
| `variableShown` | `frontend/src/_helpers/variableText.helper.ts` | старе й нове значення в місцях нестабільного тексту |
| `BeforeAfter` | `frontend/src/components/TestDetailsDialog/BeforeAfter.tsx` | один рядок замість «Було / Стало» |
| `WhatsCompared` | `frontend/src/components/TestDetailsDialog/WhatsCompared.tsx` | схема ліворуч, групи праворуч, нові рядки й меню |
| `ComparedMap` | `frontend/src/components/TestDetailsDialog/ComparedMap.tsx` | нейтральна рамка |
| `InsightsPanel` | `frontend/src/components/TestDetailsDialog/InsightsPanel.tsx` | порядок, підзаголовок «Зміни», позначки, картка |
| `TestDetailsModal` | `frontend/src/components/TestDetailsDialog/TestDetailsModal.tsx` | кнопка бага завжди, `onEditRule` |
| словники | `frontend/src/i18n/en.ts`, `uk.ts` | нові тексти (REQ-074-32) |

## Дані

Нічого нового: ні таблиць, ні колонок, ні API. Поріг 25 % — константа `MOST_OF_SCREEN`.

## Ризики

| Ризик | Що робимо |
|---|---|
| Значення еталона для нестабільного тексту неточне, коли селектор знаходить кілька елементів | беремо елемент еталона лише тоді, коли він один; інакше збережене в правилі значення |
| Тести Playwright і скриншот-еталони покладаються на старі `data-testid` | оновлюємо тести в тому самому коміті; еталони — лише в Docker, і лише якщо знятий екран змінився |
| Без заголовка «N змін» немає числа в панелі | число лишається на вкладці «Зміни» (припущення специфікації) |

## Перевірка вимог

| Вимога | Перевірка |
|---|---|
| REQ-074-01 | `frontend/src/_helpers/whatsCompared.helper.test.ts › hides the verdict when it only repeats the status` |
| REQ-074-02 | `frontend/integration_tests/test/elementRules.spec.ts › lists changes under a plain Changes heading, each marked by how it was seen` |
| REQ-074-03 | `frontend/src/_helpers/whatsCompared.helper.test.ts › marks a change by how it was seen` |
| REQ-074-04 | `frontend/src/_helpers/wordDiff.helper.test.ts › puts removed words right before the added ones in one line` |
| REQ-074-05 | `frontend/integration_tests/test/elementRules.spec.ts › shows the map and every rule group open, without a summary or a toggle` |
| REQ-074-06 | `frontend/integration_tests/test/elementRules.spec.ts › shows the map and every rule group open, without a summary or a toggle` |
| REQ-074-07 | `frontend/integration_tests/test/elementRules.spec.ts › shows the map and every rule group open, without a summary or a toggle` |
| REQ-074-08 | `frontend/src/_helpers/whatsCompared.helper.test.ts › groups ignore zones by where they come from` |
| REQ-074-10 | `frontend/src/_helpers/variableText.helper.test.ts › shows the baseline value crossed out before the current one` |
| REQ-074-11 | `frontend/integration_tests/test/elementRules.spec.ts › a variable text that holds shows a tick, one that broke turns red without the help box` |
| REQ-074-12 | `frontend/integration_tests/test/elementRules.spec.ts › a variable text that holds shows a tick, one that broke turns red without the help box` |
| REQ-074-13 | `frontend/src/_helpers/whatsCompared.helper.test.ts › says that the variable text changed shape in one line` |
| REQ-074-14 | `frontend/integration_tests/test/elementRules.spec.ts › a variable text that holds shows a tick, one that broke turns red without the help box` |
| REQ-074-15 | `frontend/integration_tests/test/elementRules.spec.ts › the menu of a variable text edits, shows and removes its rule` |
| REQ-074-20 | `frontend/integration_tests/test/reportBug.spec.ts › shows Report bug turned off with a hint when the project has no Jira` |
| REQ-074-21 | `frontend/src/_helpers/whatsCompared.helper.test.ts › makes the bug button stand out when a rule failed or most of the screen changed` |
| REQ-074-30 | `frontend/src/_helpers/whatsCompared.helper.test.ts › calls more than a quarter of the screen most of the screen` |
| REQ-074-31 | `frontend/integration_tests/test/elementRules.spec.ts › shows one card instead of the list when most of the screen changed` |
| REQ-074-32 | manual: `npx tsc --noEmit -p .` у `frontend` — пропущений переклад нового ключа є помилкою типів |
