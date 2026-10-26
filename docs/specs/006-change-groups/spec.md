# 006 — Групи змін і підказки щодо шуму

- **Статус:** Implemented
- **Оновлено:** 2026-10-27
- **Код:** `backend/src/test-runs/change-groups.service.ts`, `ui-tree/structure-diff.ts`,
  `ui-tree/screen-checks.ts` (`componentChanges`), `ui-tree/noise-hints.ts`,
  `frontend/src/components/ChangeGroups.tsx`

## Проблема

Одна зміна спільного компонента (тулбар, нижнє меню) або однакова зміна на всіх пристроях дає
десятки карток, які приймаються по одній.

## Вимоги

| ID | Вимога |
|---|---|
| REQ-006-01 | СИСТЕМА ПОВИННА групувати знімки збірки, що потребують рішення, за однаковою зміною елементів (відбиток зміни з UI-дерева, незалежний від зсуву), навіть на різних екранах. |
| REQ-006-02 | ЯКЩО частину зміни знімка дерево не пояснює, ТО СИСТЕМА ПОВИННА не включати його в структурну групу. |
| REQ-006-03 | СИСТЕМА ПОВИННА групувати той самий компонент, однаково змінений на кількох екранах («Component id/bottom_nav, changed the same way on N screens»), і окремо показувати екрани, де змінилось ще щось. |
| REQ-006-04 | Без дерева СИСТЕМА ПОВИННА групувати прогони одного екрана з однаковим підписом зміни (кольорова гістограма, незалежна від позиції) на різних пристроях і браузерах; нові знімки — в кінці. |
| REQ-006-05 | СИСТЕМА ПОВИННА давати прийняти або відхилити всю групу одним рішенням, з підтвердженням. |
| REQ-006-06 | СИСТЕМА ПОВИННА розпізнавати шум: зміна лише в статус-барі, текст із часом, датою або сумою, кілька пікселів згладжування; і пропонувати в один клік ігноровану область або правило. |

## Трасування

| Вимога | Перевірка (`backend/src/…`) |
|---|---|
| 01 | `test-runs/change-groups.service.spec.ts › groups the same element change across screens…`; `ui-tree/structure-diff.spec.ts › gives the same fingerprint to the same change however far things moved` |
| 02 | `change-groups.service.spec.ts › leaves a run out of a structural group when part of its change is invisible to the tree` |
| 03 | `change-groups.service.spec.ts › groups one component changed the same way on several screens`; `ui-tree/screen-checks.spec.ts › componentChanges › …` |
| 04 | `change-groups.service.spec.ts › groups runs of one screen with matching change signatures…` |
| 05 | manual: Changes → Approve all N |
| 06 | `change-groups.service.spec.ts › marks a group whose members only changed in the status bar`; `ui-tree/structure-diff.spec.ts › findNoiseHints › …` |
