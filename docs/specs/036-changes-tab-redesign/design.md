# 036 — Дизайн

Специфікація: [spec.md](spec.md). Макет: [фінальний варіант](https://claude.ai/artifact/B5Ji2NrYsZ4P3hb3Zd7vs8).

## Підхід

Зміна лише у фронтенді: бекенд уже віддає все, що треба (`structure.regions`, `changes`,
`size`), і підрахунок змін лишається тим самим (REQ-036-16).

1. **Рядки змін — чиста функція.** `changeRows(regions, changes)` у `changedAreas.ts` складає
   перелік: елемент з усіма його плямами й тим, що про нього каже UI-дерево (зміна тексту
   зливається з плямами того самого вузла за `key`), окремі рядки для змін дерева без плям,
   номери «n з m» для однакових назв згори вниз і один останній рядок «N місць поза
   елементами». `countRows` рахує рядок елемента як одну зміну, а місця поза елементами — кожне
   окремо; `countChanges` тепер іде через них, тож заголовок і перелік не розходяться.
2. **Назва без id.** `splitElement` розбирає назву, що тягнеться на кілька рядків (там був
   перенос, і регулярний вираз не збігався), і стискає пробіли (REQ-036-13).
3. **Місце словами.** `whereOn(rect, size)` каже третину екрана («угорі ліворуч»), тож розгорнутий
   рядок показує «56 × 64 px, ліворуч», а не координати. Без `size` — координати, як було.
4. **Результат.** `verdict` повертає порожню причину для «N змін» і «Змін немає»;
   `ComparisonVerdict` малює іконку замість числа і не малює порожню причину (REQ-036-01…03).
5. **«Межі порівняння».** `WhatsCompared` отримує `startOpen` (немає змін → розгорнутий),
   шапка стає кнопкою з `aria-expanded`; групи, ігноровані й допустимі рядки, нестабільний текст
   і «Не впливають» показуються лише розгорнутими, а обрані елементи й проблеми — завжди
   (REQ-036-34). Заголовки — звичайним регістром без кількостей; підсумок без числа
   (REQ-036-30…33). Унизу блоку — «Обрати елементи» (E) з поясненням і «⋯» → «Правило вручну»
   (REQ-036-40…42); старий рядок під вкладкою прибрано.

ADR не потрібен: модель даних і поведінка порівняння не змінюються.

## Компоненти

| Компонент | Шлях | Роль |
|---|---|---|
| Рядки змін | `frontend/src/components/TestDetailsDialog/changedAreas.ts` | `splitElement` (кілька рядків), `changeRows`, `countRows`, `rowName`, `whereOn` (REQ-036-11…16, 22). |
| Підсумки вкладки | `frontend/src/_helpers/whatsCompared.helper.ts` | `countChanges` через `changeRows`; `verdict` без причини для «N змін» і «Змін немає» (REQ-036-02, 16). |
| Заголовок результату | `frontend/src/components/TestDetailsDialog/ComparisonVerdict.tsx` | Іконка замість числа, причина лише непорожня (REQ-036-01…03). |
| Перелік змін | `frontend/src/components/TestDetailsDialog/InsightsPanel.tsx` | Перелік одразу під результатом, без заголовка; рядок — назва, «· n з m», що змінилось; дії з'являються при наведенні чи фокусі; клік розгортає місця по 5 із «ще N»; наведення підсвічує рядок або одне місце (REQ-036-10…22). Нижній рядок «Змінити, що порівнюється» прибрано (REQ-036-42). |
| Межі порівняння | `frontend/src/components/TestDetailsDialog/WhatsCompared.tsx` | Згортання, назва, підсумок і групи без кількостей, звичайний регістр, дії вибору елементів (REQ-036-30…34, 40, 41). |
| Тексти | `frontend/src/i18n/en.ts`, `frontend/src/i18n/uk.ts` | Нові `changes.*`, `compared.selectHelp`, `compared.manualRule`, `compared.moreActions`; змінені `compared.title`, `compared.except`, `compared.only`; прибрано `panel.spots`, `panel.addRuleButton`, `compared.changeWhat`, `changes.title`, `verdict.sameWhy`, `verdict.sameOnlyWhy`, `verdict.changesWhy`, `compared.*Help` крім `noTreeHelp`. |

## Дані

Без змін: ні бази, ні API.

## Потік

`structure` → `changeRows` → `countRows` (заголовок) і рядки переліку → наведення
`onPreviewRegion(bounds | place)` підсвічує на обох знімках, як і раніше.

## Ризики

| Ризик | Що робимо |
|---|---|
| Зміна тексту й плями того самого вузла тепер один рядок, тож «N змін» може стати меншим. | Так задумано (граничний випадок спеки); тест на злиття в `changedAreas.test.ts`. |
| Дії рядка невидимі без наведення — їх не знайдуть з клавіатури. | Вони з'являються й на `:focus-within`; кнопки лишаються в порядку табуляції. |
| Згорнутий блок ховає правило, яке QA шукає. | Згортаємо лише за наявності змін; проблеми й обрані елементи видно завжди. |

## Перевірка вимог

| Вимога | Перевірка |
|---|---|
| REQ-036-01 | `manual: екран зі змінами — у значку результату іконка, числа там немає` |
| REQ-036-02 | `frontend/src/_helpers/whatsCompared.helper.test.ts › gives the count alone when there are changes` |
| REQ-036-03 | `frontend/src/_helpers/whatsCompared.helper.test.ts › puts a compare-only problem in the heading` |
| REQ-036-10 | `frontend/integration_tests/test/elementRules.spec.ts › says the count once and lists the changes straight under it` |
| REQ-036-11 | `frontend/integration_tests/test/elementRules.spec.ts › says the count once and lists the changes straight under it` |
| REQ-036-12 | `manual: навести на рядок — тип і id у підказці; розгорнути — тип і id над місцями` |
| REQ-036-13 | `frontend/src/components/TestDetailsDialog/changedAreas.test.ts › keeps the id apart from a name that runs over several lines` |
| REQ-036-14 | `frontend/src/components/TestDetailsDialog/changedAreas.test.ts › leaves rows with the same name unnumbered` |
| REQ-036-15 | `frontend/src/components/TestDetailsDialog/changedAreas.test.ts › puts the spots no element wraps in one last row…` |
| REQ-036-16 | `frontend/src/components/TestDetailsDialog/changedAreas.test.ts › puts the spots no element wraps in one last row…` |
| REQ-036-17 | `frontend/integration_tests/test/elementSelection.spec.ts › offers element actions on a changed area` |
| REQ-036-20 | `frontend/integration_tests/test/elementRules.spec.ts › says the count once and lists the changes straight under it` |
| REQ-036-21 | `manual: навести на рядок «Next» — на обох знімках підсвічено всі його місця` |
| REQ-036-22 | `frontend/integration_tests/test/elementRules.spec.ts › opens a row into its spots, five at a time` |
| REQ-036-30 | `frontend/integration_tests/test/elementRules.spec.ts › says the count once and lists the changes straight under it` |
| REQ-036-31 | `frontend/integration_tests/test/elementRules.spec.ts › folds the comparison scope while there are changes to look at` |
| REQ-036-32 | `frontend/integration_tests/test/elementRules.spec.ts › lists the rules for this screen and for every screen` |
| REQ-036-33 | `frontend/integration_tests/test/elementRules.spec.ts › folds the comparison scope while there are changes to look at` |
| REQ-036-34 | `frontend/integration_tests/test/elementRules.spec.ts › folds the comparison scope while there are changes to look at` |
| REQ-036-40 | `frontend/integration_tests/test/elementSelection.spec.ts › turns on element selection from the Changes tab` |
| REQ-036-41 | `manual: «⋯» поруч з «Обрати елементи» → «Правило вручну…» відкриває повну форму правила` |
| REQ-036-42 | `manual: під блоками вкладки немає рядка «Змінити, що порівнюється» і посилання «Додати правило елемента»` |
