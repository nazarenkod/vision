# 078 — Дизайн

## Підхід

- **Дія на рядку (REQ-078-01…03).** Бекенд додає до кожної зміни `index`, тобто номер вузла
  поточного дерева (у зниклого вузла його немає). `TestDetailsModal.quickVariable(change)` робить таке:
  - знаходить елемент знімка за `index`;
  - звіряє, що його текст — це текст «після» зміни;
  - бере шматки, що відрізняються, через `changedPieces(text, before)` у `variableText.helper.ts`.
    Шматки обох текстів (033) вирівнюються найдовшою спільною послідовністю, а змінене —
    це шматки поточного тексту поза нею. Якщо спільних шматків немає, повертається `null`.

  Далі будуються `partsOf`, `variableSelector` і `fitsParts`, як у поповері. Повертається
  дія, що викликає наявний `actVariable({ parts, scope: "screen", selector })`, а він уже
  зберігає правило, перепорівнює знімок і показує Undo. `InsightsPanel` показує кнопку
  (`quickVariable`) серед дій рядка лише тоді, коли дія є і користувач може змінювати проєкт.
- **Один рядок (REQ-078-04).** `changeRows` спершу ставить зміни вмісту, потім розміру. Зміна з
  `key`, для якого вже є рядок, іде в `more` цього рядка й не створює свого. `whatChanged` показує
  `more` рядками під основною зміною. `changeMark` вважає рядок видимим, якщо видно хоча б одну з
  його змін.
- **Пара без місця (REQ-078-05).** Коли пари за місцем немає, `pairsByPlace` додатково шукає серед
  елементів без пари одного двійника того самого класу з текстом і підписом, що відрізняються
  лише числами. Двійник має бути єдиним в обидва боки: інакше пару не ставимо.

## Компоненти

| Компонент | Шлях | Роль |
|---|---|---|
| `StructuralChange.index`, `pairsByPlace` | `backend/src/ui-tree/structure-diff.ts` | вузол зміни, пара без місця |
| `StructuralChange.index` | `frontend/src/types/insights.ts` | тип |
| `changedPieces` | `frontend/src/_helpers/variableText.helper.ts` | що позначити |
| `quickVariable` | `frontend/src/components/TestDetailsDialog/TestDetailsModal.tsx` | правило з рядка |
| кнопка, `more` | `frontend/src/components/TestDetailsDialog/InsightsPanel.tsx` | дія й другий рядок |
| `changeRows` | `frontend/src/components/TestDetailsDialog/changedAreas.ts` | один рядок на елемент |
| `changeMark` | `frontend/src/_helpers/whatsCompared.helper.ts` | позначка об'єднаного рядка |
| словники | `frontend/src/i18n/en.ts`, `uk.ts` | `changes.quickVariable` |

## Дані

Без змін у базі. У відповіді `structure` кожна зміна отримує ще поле `index`.

## Ризики

| Ризик | Що робимо |
|---|---|
| Правило з одного кліку позначить не те, що QA мав на увазі | Undo в сповіщенні, а правило видно в «Нестабільний текст» з меню ⋯ |
| Пара без місця з'єднає не ті елементи | лише коли двійник один в обидва боки і тексти відрізняються самими числами |
| Текст елемента на знімку — не той, що змінився (у вузла змінились і текст, і підпис) | дії немає: текст «після» має збігатися з текстом елемента |

## Перевірка вимог

| Вимога | Перевірка |
|---|---|
| REQ-078-01 | `frontend/integration_tests/test/quickVariable.spec.ts › saves a variable-text rule for what changed in a text in one click` |
| REQ-078-02 | `frontend/src/_helpers/variableText.helper.test.ts › marks what is not where the baseline has it: numbers or words` |
| REQ-078-03 | `frontend/integration_tests/test/quickVariable.spec.ts › offers no one-click rule for a text that shares nothing with the baseline` |
| REQ-078-04 | `frontend/src/components/TestDetailsDialog/changedAreas.test.ts › shows a text change and a resize of one element in one row, the text first` |
| REQ-078-05 | `backend/src/ui-tree/number-change.spec.ts › pairs the one look-alike when the element around has no twin on the baseline` |
| REQ-078-06 | manual: `npx tsc --noEmit -p .` у `frontend` — пропущений переклад нового ключа є помилкою типів |
