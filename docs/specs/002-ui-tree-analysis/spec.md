# 002 — Аналіз UI-дерева для порівняння екранів

- **Статус:** Implemented
- **Оновлено:** 2026-10-27
- **Пов'язане:** [012](../012-java-sdk/spec.md) (як дерево надходить), [003](../003-accessibility-checks/spec.md), [006](../006-change-groups/spec.md)
- **Код:** `backend/src/ui-tree/` (`ui-tree.parser.ts`, `comparison-inputs.ts`, `structure-diff.ts`,
  `screen-checks.ts`, `noise-hints.ts`, `ui-tree.service.ts`), `frontend/…/InsightsPanel.tsx` (вкладка Changes)

## Проблема

Піксельне порівняння мобільних екранів шумить: годинник і батарея, зсув списку банером, дрібні
зміни всередині відомо мінливих елементів. Водночас воно пропускає зміни, яких не видно в
пікселях: вимкнену кнопку, новий підпис, невидиму кнопку поверх екрана.

## Вимоги

### Дерево

| ID | Вимога |
|---|---|
| REQ-002-01 | СИСТЕМА ПОВИННА розбирати page source Appium для Android (UiAutomator2) та iOS (XCUITest), а також звичайний дамп uiautomator; формат визначається сама, якщо його не надіслали. |
| REQ-002-02 | СИСТЕМА ПОВИННА переводити межі вузлів у пікселі скриншота (iOS points → pixels, менший скриншот → масштаб), а розміри — у dp за щільністю пристрою або за оцінкою. |
| REQ-002-03 | СИСТЕМА ПОВИННА давати кожному вузлу стабільний ключ: `id:<resource id>`, інакше `Class:текст`, інакше шлях; повтори — `#1`, `#2`. |
| REQ-002-04 | ЯКЩО вхід не є page source Appium, ТО СИСТЕМА ПОВИННА прийняти знімок без дерева. |

### Порівняння (налаштування проєкту)

| ID | Вимога |
|---|---|
| REQ-002-10 | ДЕ ввімкнено, СИСТЕМА ПОВИННА виключати з порівняння статус-бар і навігаційний бар (з дерева, інакше смуга 24 dp зверху). |
| REQ-002-11 | ДЕ ввімкнено компенсацію зсувів, СИСТЕМА ПОВИННА порівнювати зсунуті елементи на новому місці (до заданої відстані, без зміни розміру), позначаючи лише нове, але не приховуючи змін усередині зсунутого елемента. |
| REQ-002-12 | СИСТЕМА ПОВИННА застосовувати правила елементів (`id:`, `class:`, `text:` з regex): ігнорувати елемент або допускати N% змін у ньому, для перевірки чи для проєкту; область іде за елементом там, де він був і де він є. |
| REQ-002-13 | СИСТЕМА ПОВИННА давати вибрати елемент кліком по скриншоту замість введення селектора. |

### Перевірки екрана

| ID | Вимога |
|---|---|
| REQ-002-20 | КОЛИ пікселі збіглися, але змінився підпис, стан (вимкнений, некліковий) або поверх з'явився невидимий елемент, СИСТЕМА ПОВИННА відправити знімок на рев'ю (`unresolved`) і ніколи не приймати його автоматично. |
| REQ-002-21 | СИСТЕМА ПОВИННА попереджати, що знімок зроблено зарано: видимий спінер, skeleton, shimmer, «Loading…», toast. |
| REQ-002-22 | СИСТЕМА ПОВИННА попереджати про «не той екран», коли дерево мало схоже на дерево еталона, і називати відомий екран, на який воно схоже. Для перевірки без жодного еталона — не попереджати. |
| REQ-002-23 | СИСТЕМА ПОВИННА називати елемент, що найкраще обгортає кожну змінену область, і показувати зміни тексту, додані та зникли елементи, зміни розміру. |

## Трасування

| Вимога | Перевірка (`backend/src/ui-tree/…`) |
|---|---|
| 01, 02, 03, 04 | `ui-tree.parser.spec.ts › detects the format`, `› converts pixels to dp…`, `› estimates density…`, `› gives every node a unique key…`, `› scales bounds…`, `› rejects input that is not an Appium page source`, `› reads nodes by their class attribute…` |
| 10 | `comparison-inputs.spec.ts › uses the status and navigation bar views…`, `› falls back to a 24 dp band at the top` |
| 11 | `comparison-inputs.spec.ts › computeMoves › …`, `› only flags what is new once the move is compensated`, `› still flags a moved card that also changed` |
| 12 | `comparison-inputs.spec.ts › element selectors › …`, `› covers an element where it was and where it is now`, `› clears small changes inside a tolerated area` |
| 13 | manual: Changes → «Pick element on screenshot» |
| 20 | `screen-checks.spec.ts › reports a control that became disabled…`, `› reports an invisible control added on top…`; `test-runs/test-runs.service.spec.ts › calculateDiff keeps a run in review when the pixels match but an element change stays hidden` |
| 21 | `screen-checks.spec.ts › finds a visible spinner`, `› finds a shimmer placeholder…`, `› ignores hidden spinners…` |
| 22 | `screen-checks.spec.ts › is high for the same screen and low for another one`; `ui-tree.service.spec.ts › warns about a wrong screen against another device…` |
| 23 | `structure-diff.spec.ts › reports text changes…`, `› names the element that best wraps each changed area` |
