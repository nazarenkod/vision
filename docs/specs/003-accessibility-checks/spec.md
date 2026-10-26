# 003 — Перевірки доступності

- **Статус:** Implemented
- **Оновлено:** 2026-10-27
- **Пов'язане:** [002](../002-ui-tree-analysis/spec.md) (UI-дерево), [004](../004-a11y-problems/spec.md)
  (що робимо зі знахідками)
- **Код:** `backend/src/a11y/a11y.rules.ts`, `contrast.ts`, `ui-tree/ui-tree.service.ts` (`analyze`),
  `frontend/…/InsightsPanel.tsx` (вкладка Accessibility), `TestDetailsModal.tsx` (оверлей)

## Проблема

Доступність мобільних екранів не перевіряють, бо руками це довго. А UI-дерево, яке знімає
Appium, уже містить усе потрібне: підписи, розміри, стани. Контраст можна виміряти прямо на
скриншоті.

## Вимоги

| ID | Вимога |
|---|---|
| REQ-003-01 | КОЛИ знімок надійшов з UI-деревом, СИСТЕМА ПОВИННА перевірити його правилами доступності й зберегти звіт файлом, а в рядку знімка — лічильники. |
| REQ-003-02 | СИСТЕМА ПОВИННА знаходити інтерактивний елемент без підпису, який міг би озвучити TalkBack / VoiceOver (`missing-label`, error). Текст дочірніх елементів вважається підписом контейнера. |
| REQ-003-03 | СИСТЕМА ПОВИННА знаходити зону тапу, меншу за 48×48 dp на Android або 44×44 pt на iOS, з допуском 0,5 (`touch-target`, warning); розмір — за щільністю пристрою, а якщо її не надіслано — за оцінкою, і про це СИСТЕМА ПОВИННА попередити. |
| REQ-003-04 | СИСТЕМА ПОВИННА знаходити текст з контрастом, нижчим за 4,5 : 1 (3 : 1 для великого тексту від 28 dp, до 30 символів), виміряним на пікселях скриншота (`low-contrast`, warning). |
| REQ-003-05 | СИСТЕМА ПОВИННА знаходити поле вводу без підпису, підказки й тексту (`input-without-label`), однаковий підпис у кількох елементів (`duplicate-label`), роль у підписі («button», «кнопка»; `redundant-role`, info) і кнопку iOS, приховану від VoiceOver (`not-accessible`). |
| REQ-003-06 | СИСТЕМА ПОВИННА порівнювати знахідки з деревом еталона і ділити їх на нові, наявні й виправлені; без дерева еталона всі знахідки — нові. |
| REQ-003-07 | ДЕ пристрій ще не має свого еталона, СИСТЕМА ПОВИННА порівнювати зі знахідками еталона тієї ж перевірки на іншому пристрої. |
| REQ-003-08 | СИСТЕМА ПОВИННА не рахувати поради (`info`) у лічильниках, а знахідки із заведеним багом чи false positive — серед нових ([004](../004-a11y-problems/spec.md)). |
| REQ-003-09 | СИСТЕМА ПОВИННА показувати знахідки нумерованими рамками поверх скриншота; клік по картці масштабує до елемента. |

## Трасування

| Вимога | Перевірка (`backend/src/…`) |
|---|---|
| 01, 02 | `a11y/a11y.rules.spec.ts › finds the issues of an Android screen`, `› reads the text of child views as the label…`, `› finds the issues of an iOS screen` |
| 03 | `a11y/a11y.rules.spec.ts › reports touch target size in dp`; `ui-tree/ui-tree.parser.spec.ts › estimates density when the client did not send it` |
| 04 | `a11y/a11y.rules.spec.ts › checks text contrast against the screenshot`, `estimateContrast › …` |
| 05 | `a11y/a11y.rules.spec.ts › finds the issues of an Android screen` / `…iOS screen` |
| 06 | `a11y/a11y.rules.spec.ts › splits issues into new, existing and fixed against the baseline`, `› counts everything as new without a baseline tree` |
| 07 | `ui-tree/ui-tree.service.spec.ts › warns about a wrong screen against another device…` (той самий шлях вибору еталона) |
| 08 | `a11y/a11y-issues.spec.ts › counts everything nobody acted on…`, `› takes filed bugs out of the new count…` |
| 09 | manual: відкрити знімок з деревом → вкладка Accessibility |
