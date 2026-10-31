# 006 — Дизайн

## Підхід

`ChangeGroupsService.getGroups(buildId)` бере знімки збірки, що чекають рішення, і групує їх у
такому порядку:
1. з деревами — за відбитком структурної зміни (`diffTrees`), незалежним від позиції;
2. за компонентом — однаковий хеш області компонента до й після (`componentChanges`);
3. без дерев — за підписом зміни (кольорова гістограма з пул-воркера, `signaturesMatch`) у
   межах одного екрана.

Шум розпізнається правилами (`findNoiseHints`), без моделі.

## Компоненти

| Компонент | Шлях | Роль |
|---|---|---|
| Групи | `backend/src/test-runs/change-groups.service.ts` | `getGroups`; `GET /test-runs/groups?buildId=` |
| Відбиток зміни | `backend/src/ui-tree/structure-diff.ts` | `diffTrees` |
| Компоненти | `backend/src/ui-tree/screen-checks.ts` | `componentChanges`, `areaHash` |
| Шум | `backend/src/ui-tree/noise-hints.ts` | `findNoiseHints` |
| UI | `frontend/src/components/ChangeGroups.tsx` | картки груп, підтвердження, Approve/Reject all |

## Перевірка вимог

| Вимога | Перевірка |
|---|---|
| REQ-006-01 | `backend/src/test-runs/change-groups.service.spec.ts › groups the same element change across screens when UI trees are available`; `backend/src/ui-tree/structure-diff.spec.ts › gives the same fingerprint to the same change however far things moved` |
| REQ-006-02 | `backend/src/test-runs/change-groups.service.spec.ts › leaves a run out of a structural group when part of its change is invisible to the tree` |
| REQ-006-03 | `backend/src/test-runs/change-groups.service.spec.ts › groups one component changed the same way on several screens`; `backend/src/ui-tree/screen-checks.spec.ts › marks a component that holds only part of the changes` |
| REQ-006-04 | `backend/src/test-runs/change-groups.service.spec.ts › groups runs of one screen with matching change signatures, and lists new screenshots last` |
| REQ-006-05 | manual: Changes → «Approve all N» → діалог підтвердження → усі прийняті |
| REQ-006-06 | `backend/src/test-runs/change-groups.service.spec.ts › marks a group whose members only changed in the status bar`; `backend/src/ui-tree/structure-diff.spec.ts › recognises text that holds an amount`; `backend/src/ui-tree/structure-diff.spec.ts › flags a handful of edge pixels as rendering noise`; `backend/src/ui-tree/structure-diff.spec.ts › calls the whole iOS status bar band noise…` |
| REQ-006-07 | manual: група шуму статус-бару → «Ignore status bar»; група згладжування — лише пояснення, без кнопки |
