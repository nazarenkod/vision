# 063 — Дизайн

## Підхід

Те саме дерево й ті самі маршрути, що в [062](../062-ui-tree-inspector/design.md).

- **Сервер** (`inspectorTree`) додає вузлу три поля:
  - `wrapper` — немає id, тексту, підпису, підказки й дії, але є дочірні;
  - `clickable`;
  - `selector` — селектор правила з `selectorForNode`, без xpath, тож він дешевий.

  Текст, атрибути й локатори для тестів він віддає з розкодованими символьними посиланнями
  (`decodeCharRefs`, тепер експортований з парсера). Селектори Vision лишаються за сирим деревом,
  бо правила звіряють саме його.
- **Чисті функції** в `_helpers/treeInspector.helper.ts`:
  - `visibleRows` з параметром `wrappers`: дочірні схованої обгортки піднімаються до найближчого
    показаного предка; рядок знає свій показаний `parent`, `levels` для ліній, `skipped` для «+N» і
    `childCount`;
  - `foldedPath` (шлях, де ланцюжки обгорток стиснуті);
  - `splitMatch` (підсвічування збігу);
  - `oneLine` («↵»);
  - `splitId` (компонент після «#»);
  - `nodeKind` (вид вузла для іконки);
  - `stepMarked` (наступна чи попередня зміна);
  - `nodeAt` тепер пропускає обгортки.
- **`ElementsTab`**:
  - над деревом — пошук з «N з M» і ↑ ↓, чипи з кількістю, перемикач «Обгортки»;
  - у рамці дерева — смуга зі шляхом, переходом між змінами, «Розгорнути все» й «Згорнути все»;
  - рядок: лінії рівнів (лінія рівня вибраного вузла — `tokens.brand`), шеврон, іконка MUI виду,
    назва, `#id` і мітка компонента, текст, «+N», кнопка копіювання селектора, кількість у
    згорнутого, позначки;
  - позначки не стискаються, а текст і id обрізаються, `overflowX: hidden`;
  - роздільник змінює висоту дерева й пам'ятає її в `localStorage` (`vision.treeHeight`);
  - у картці — перемикач «Лише заповнені».

  Кольори, шрифти й кути — лише з теми; іконки — `@mui/icons-material`.

## Компоненти

| Компонент | Шлях | Роль |
|---|---|---|
| `inspectorTree`, `nodeLocators` | `backend/src/ui-tree/inspector-tree.ts` | `wrapper`, `clickable`, `selector`; розкодування |
| `decodeCharRefs` | `backend/src/ui-tree/ui-tree.parser.ts` | експорт |
| хелпер | `frontend/src/_helpers/treeInspector.helper.ts` | функції вище |
| `ElementsTab`, `KindIcon` | `frontend/src/components/TestDetailsDialog/ElementsTab.tsx` | рядок, панель над деревом, роздільник, картка |
| тип `InspectorNode` | `frontend/src/types/insights.ts` | нові поля |

## Дані

Нового в базі й файлах немає. Нові поля відповіді (`wrapper`, `clickable`, `selector`) обчислюються на льоту.

## Ризики

| Ризик | Що робимо |
|---|---|
| Сховано те, що QA шукає | «+N» біля вузла, «⋯ N» у шляху, перемикач поруч; посилання на обгортку вмикає їх |
| Клавіші вкладки й порівняння (A, X, E) | дерево відповідає лише на свої клавіші й зупиняє їхнє поширення; Esc у пошуку не закриває порівняння |
| Розкодований текст ламає правила | селектори Vision будуються з сирого дерева, як і звіряють правила |

## Перевірка вимог

| Вимога | Перевірка |
|---|---|
| REQ-063-01 | `frontend/src/_helpers/treeInspector.helper.test.ts › hides wrappers and lifts their children, counting what was hidden` |
| REQ-063-02 | `frontend/src/components/TestDetailsDialog/ElementsTab.test.tsx › shows wrappers when asked, hidden by default with how many` |
| REQ-063-03 | `frontend/src/_helpers/treeInspector.helper.test.ts › shows every node once wrappers are asked for` |
| REQ-063-04 | `backend/src/ui-tree/inspector-tree.spec.ts › reads character references as people do, and a test finds the real characters` |
| REQ-063-05 | `frontend/src/_helpers/treeInspector.helper.test.ts › folds a run of wrappers in the path and cuts a long one` |
| REQ-063-06 | `frontend/src/_helpers/treeInspector.helper.test.ts › gives each row the levels above it for the level lines` |
| REQ-063-07 | `frontend/src/_helpers/treeInspector.helper.test.ts › names the kind of a node on Android, iOS and the web` |
| REQ-063-08 | `frontend/src/components/TestDetailsDialog/ElementsTab.test.tsx › shows a line break as ↵, the component apart and each kind's icon` |
| REQ-063-09 | `frontend/integration_tests/test/elementsTab.spec.ts › a deep tree keeps its marks whole and never scrolls sideways` |
| REQ-063-10 | `frontend/src/components/TestDetailsDialog/ElementsTab.test.tsx › counts the children of a folded node` |
| REQ-063-11 | `frontend/src/components/TestDetailsDialog/ElementsTab.test.tsx › marks search matches and steps through them with Enter` |
| REQ-063-12 | `frontend/src/components/TestDetailsDialog/ElementsTab.test.tsx › filters by a chip with its count` |
| REQ-063-13 | `frontend/src/components/TestDetailsDialog/ElementsTab.test.tsx › goes to the next change with N and with the button` |
| REQ-063-14 | `frontend/src/components/TestDetailsDialog/ElementsTab.test.tsx › counts the children of a folded node` |
| REQ-063-15 | `frontend/src/components/TestDetailsDialog/ElementsTab.test.tsx › copies the rule's selector from the row and with C` |
| REQ-063-16 | `frontend/src/components/TestDetailsDialog/ElementsTab.test.tsx › keeps the tree height it is given` |
| REQ-063-17 | `frontend/src/components/TestDetailsDialog/ElementsTab.test.tsx › hides empty attributes until asked` |
| REQ-063-18 | `frontend/src/components/TestDetailsDialog/ElementsTab.test.tsx › clears the search with Esc without closing the comparison` |
| REQ-063-19 | `frontend/src/_helpers/treeInspector.helper.test.ts › never chooses a wrapper on the screenshot` |
