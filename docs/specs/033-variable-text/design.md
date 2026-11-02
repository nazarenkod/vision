# 033 — Дизайн

Специфікація: [spec.md](spec.md). Макет: [полотно](https://claude.ai/artifact/6BuVVzbQ8MjXUqabgmHsRX).

## Підхід

Нова дія правила елемента, `variable`, поруч з `ignore`, `tolerate`, `compare`. Правило зберігає
перевірку як список частин: незмінний текст і місця з регулярним виразом. Нової таблиці й
міграції немає: правила вже лежать JSON-ом у налаштуваннях проєкту й перевірки.

1. **Вираз будує фронтенд, перевіряє бекенд.** Поділ тексту на шматки, злиття позначених і
   вираз для місця (REQ-033-03, 04, 07) потрібні лише в поповері, тож живуть чистою функцією
   у `frontend/src/_helpers/variableText.helper.ts`. Бекенд отримує готові частини, перевіряє,
   що вони цілі (є місце, вирази розбираються, довжина в межах), і сам ними нічого не будує.
   Збирання частин у один вираз (`^…$`, прапор `u`, пробіли) — невелика функція, що є в обох
   пакетах однаково: фронтенду вона потрібна для «Зберегти» й попередження про еталон
   (REQ-033-08, 10), бекенду — для перевірки й селектора.
2. **Пікселі — як `ignore`.** `resolveRules` кладе рамки знайдених елементів у `ignore` з обох
   дерев (REQ-033-15). Тому ж самі рамки вже відкидають зміни елемента в UI-дереві через
   `outsideAreas` (REQ-033-16): і зміну тексту, і «зник/з'явився», коли без id ключ елемента
   змінився разом із текстом (REQ-033-33).
3. **Перевірка тексту — у `resolveRules`.** Для кожного правила `variable` функція
   `checkVariableText` з `backend/src/ui-tree/variable-text.ts` перевіряє текст кожного
   знайденого в знімку елемента (REQ-033-17, 20, 24) і повертає результат на правило:
   що перевірено, що не пройшло й чому, чи зник елемент (REQ-033-19). Елемент, на який діє
   `ignore`, не перевіряється (REQ-033-22). `comparisonInputs` збирає з цього список проблем;
   при «порівнювати лише» відкидає ті, що поза `keep` (REQ-033-21).
4. **Рев'ю — як для «порівнювати лише».** `TestRunsService.calculateDiff` уже переводить у
   `unresolved` прогін, що пройшов на пікселях, але має проблеми плану `compareOnly`. Поруч
   стає `variableTextStatus` з тими самими правилами (REQ-033-18, 19).
5. **Як знаходити елемент (REQ-033-25…28).** Селектор обирає фронтенд у момент збереження:
   id, інакше `text:/^…$/u` з перевірки, якщо незмінна частина має літеру, інакше шлях від
   предка з id. Для тексту без id сервер уже рахує варіанти шляху лише для безіменних елементів;
   тепер `pickableElements` віддає для кожного тексту без id `stableSelector` — шлях донизу від
   найближчого предка з id, якщо такий є, — і сам текст елемента. `parseSelector` зберігає
   прапор `u`, щоб `\p{L}` у виразі працював у селекторі.
6. **UI.** Поповер отримує режим «нестабільний текст»: дія V не зберігає правило, а згортає
   решту дій і показує шматки (REQ-033-02). «Перевіряти текст» і «Змінити» відкривають той
   самий режим, а збереження додає нове правило з `replacesRuleId`, яке сервер прибирає в тому ж
   записі (REQ-033-14). Вкладка «Зміни» отримує групу `variable` в `overview` і причину в
   `verdict` (REQ-033-31, 32, 34); позначки на знімках — фіолетовий токен теми й червоний пунктир
   для того, що не пройшло (REQ-033-30).
7. **Групи змін (REQ-033-33).** `structuralGroups` рахує відбиток з усіх змін дерева. Для
   прогонів із правилами `variable` зміни в їхніх рамках відкидаються до відбитка.

Окремого ADR не потрібно: це ще одна дія правила елемента за 002 і 024, а рев'ю без певності
вже записане в 015.

## Компоненти

| Компонент | Шлях | Роль |
|---|---|---|
| Перевірка тексту | `backend/src/ui-tree/variable-text.ts` (новий) | `TextPart`, `partsProblem(parts)` (валідація), `partsRegex(parts)`, `checkVariableText(parts, text)` → `{ ok, reason: 'text' \| 'pattern' \| 'too-long' }`, `variableTextStatus(status, problems)` |
| Правила | `backend/src/ui-tree/comparison-inputs.ts` | `ElementRuleAction` += `variable`, `ElementRule.parts`; `resolveRules` — рамки в `ignore` і `variable[ruleId]` з результатами; `parseSelector` зберігає прапор `u` |
| Вхідні дані й структура | `backend/src/ui-tree/ui-tree.service.ts` | `comparisonInputs` → `variableProblems` (з урахуванням `keep`); `structure()` віддає `check` на правило; `pickableElements` віддає `text` і `stableSelector` |
| Додавання правила | `backend/src/test-runs/dto/element-rule.dto.ts`, `test-runs.service.ts` | `action: 'variable'`, `parts`, `replacesRuleId`; перевірка частин; рев'ю за `variableTextStatus` у `calculateDiff` |
| Групи змін | `backend/src/test-runs/change-groups.service.ts` | відкидає зміни в рамках правил `variable` перед відбитком |
| Типи | `frontend/src/types/insights.ts` | `ElementRuleAction` += `variable`; `TextPart`; `ScreenRule.check`; `PickableElement.text`, `stableSelector` |
| Шматки й вираз | `frontend/src/_helpers/variableText.helper.ts` (новий) | `splitPieces`, `placesOf`, `patternFor`, `partsOf`, `partsRegex`, `fitsParts`, `variableSelector` |
| Дії біля елемента | `ElementActions.tsx`, `ElementPopover.tsx`, `SelectionPanel.tsx` | четвертий рядок з клавішею V; режим шматків; «Перевіряти текст» / «Змінити»; у панелі кількох — недоступний |
| Екран порівняння | `TestDetailsModal.tsx` | збереження правила `variable`, Undo, позначки на знімках |
| Вкладка «Зміни» | `whatsCompared.helper.ts`, `WhatsCompared.tsx`, `ComparedMap.tsx` | група «Нестабільний текст», тег, підсвічене значення, причина в результаті |
| Тема й тексти | `frontend/src/theme.ts`, `frontend/src/i18n/en.ts`, `uk.ts` | токен `variable` для обох тем; ключі `variable.*` |

## Дані

Нічого в схемі. Правило в JSON налаштувань (`elementRules`, `checkRules`) отримує дію
`variable` і поле `parts: Array<{ text: string } | { pattern: string; sample: string }>`;
`sample` — значення, з якого вираз побудовано, для показу. Старі правила не змінюються; сервер
старої версії, якщо до нього відкотитись, пропускає невідому дію (`resolveRules` діє лише за
відомими).

## Потік

1. QA клікає текст, V → `ElementPopover` ділить `element.text` на шматки.
2. Клік по шматку → `partsOf(pieces, marked)` → `fitsParts(parts, text)`; для еталона —
   той самий елемент за селектором, і попередження, якщо не відповідає.
3. «Зберегти» → `variableSelector(element, parts)` → `POST …/element-rules` з `action: variable`,
   `parts`, `replacesRuleId?` → сервер перевіряє частини, зберігає, порівнює знову.
4. `calculateDiff` → `comparisonInputs` → `resolveRules` (рамки в `ignore`, результати) →
   `getDiff` → `variableTextStatus` → `unresolved`, якщо щось не пройшло.
5. `structure()` → правила з `check` → `overview` / `verdict` → вкладка «Зміни».

## Ризики

| Ризик | Що робимо |
|---|---|
| Повільний регулярний вираз на довгому тексті | Вирази будуємо лише ми, з лінійних частин; тексти понад 2000 знаків не перевіряємо (REQ-033-24); сервер відкидає частини з виразом довшим за 200 знаків |
| Селектор `text:/…/` збігається з іншим текстом того самого вигляду деінде на екрані | Незмінна частина має бути з літерою; лічильник «N на цьому екрані» в поповері показує, скільки знайде |
| Шлях від предка з id ламається, коли змінюється кількість рядків над елементом | Той самий ризик, що в 027; правило показує «нічого не знайдено» замість мовчання |
| Тексти без id в iOS, де `name` = підпис | Парсер уже не вважає такий `name` id ([ui-tree.parser.ts](../../../backend/src/ui-tree/ui-tree.parser.ts)) |

## Перевірка вимог

| Вимога | Перевірка |
|---|---|
| REQ-033-01 | `frontend/src/components/TestDetailsDialog/ElementPopover.test.tsx › offers Variable text as the fourth action with V` |
| REQ-033-02 | `frontend/src/components/TestDetailsDialog/ElementPopover.test.tsx › folds the other actions and shows the pieces after V` |
| REQ-033-03 | `frontend/src/_helpers/variableText.helper.test.ts › splits a text into words, numbers with their separators and single signs` |
| REQ-033-04 | `frontend/src/_helpers/variableText.helper.test.ts › joins marked pieces with only spaces between into one place` |
| REQ-033-05 | `frontend/src/components/TestDetailsDialog/ElementPopover.test.tsx › asks to click a piece, then says the rest is literal` |
| REQ-033-06 | `frontend/src/components/TestDetailsDialog/ElementPopover.test.tsx › shows the pattern of a marked piece on hover` |
| REQ-033-07 | `frontend/src/_helpers/variableText.helper.test.ts › builds a pattern for a time, a date, an amount, a signed amount, a number and a word` |
| REQ-033-08 | `frontend/src/components/TestDetailsDialog/ElementPopover.test.tsx › warns when the baseline text does not fit` |
| REQ-033-09 | `manual: обрати два тексти з Shift → у панелі вибору «Нестабільний текст» сірий, підказка «Нестабільний текст позначається для одного елемента»` |
| REQ-033-10 | `frontend/src/components/TestDetailsDialog/ElementPopover.test.tsx › saves only when a piece is marked` |
| REQ-033-11 | `manual: зберегти правило → знімок порівнюється знову, сповіщення з Undo прибирає правило` |
| REQ-033-12 | `frontend/src/components/TestDetailsDialog/ElementPopover.test.tsx › marks nothing by itself` |
| REQ-033-14 | `backend/src/test-runs/test-runs.service.spec.ts › replaces the rule it names in the same write` |
| REQ-033-15 | `backend/src/ui-tree/comparison-inputs.spec.ts › leaves a variable-text element out of the pixels where it was and where it is` |
| REQ-033-16 | `backend/src/ui-tree/comparison-inputs.spec.ts › keeps the text change of a variable-text element out of the element changes` |
| REQ-033-17 | `backend/src/ui-tree/variable-text.spec.ts › accepts a text whose fixed parts match and whose places fit` |
| REQ-033-18 | `backend/src/ui-tree/variable-text.spec.ts › tells a changed fixed text from a value that does not fit` |
| REQ-033-19 | `backend/src/ui-tree/comparison-inputs.spec.ts › reports a variable-text element that is gone from the snapshot` |
| REQ-033-20 | `backend/src/ui-tree/comparison-inputs.spec.ts › checks every element a variable-text rule finds` |
| REQ-033-21 | `backend/src/ui-tree/variable-text.spec.ts › does not count a failure outside the compared elements` |
| REQ-033-22 | `backend/src/ui-tree/comparison-inputs.spec.ts › lets an ignore rule win over a variable-text rule on the same element` |
| REQ-033-23 | `manual: прийняти знімок із «Оновлено о undefined» → правило те саме, у «Що порівнюється» пояснення й «Прибрати правило»` |
| REQ-033-24 | `backend/src/ui-tree/variable-text.spec.ts › does not check a text longer than 2000 characters` |
| REQ-033-25 | `frontend/src/_helpers/variableText.helper.test.ts › finds by id, else by the text pattern, else by a path from an id` |
| REQ-033-26 | `backend/src/ui-tree/comparison-inputs.spec.ts › finds an element by a text pattern with letters classes` |
| REQ-033-27 | `backend/src/ui-tree/ui-tree.service.spec.ts › offers a path from the nearest id for a text without an id` |
| REQ-033-28 | `frontend/src/_helpers/variableText.helper.test.ts › has no way to find a whole text without an id above it` |
| REQ-033-29 | `manual: позначити дату в рядку списку → у заголовку «4 на цьому екрані»` |
| REQ-033-30 | `manual: знімок із правилом, що пройшло, і правилом, що ні → фіолетова штриховка й червоний пунктир на обох знімках` |
| REQ-033-31 | `frontend/src/_helpers/whatsCompared.helper.test.ts › puts variable-text rules in their own group` |
| REQ-033-32 | `frontend/src/_helpers/whatsCompared.helper.test.ts › counts each variable-text element as one place` |
| REQ-033-33 | `backend/src/test-runs/change-groups.service.spec.ts › leaves variable-text changes out of the fingerprint` |
| REQ-033-34 | `frontend/src/_helpers/whatsCompared.helper.test.ts › puts a failed variable text first in the verdict` |
