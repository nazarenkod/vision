# 019 — Дизайн

## Підхід

Зміна лише у фронтенді. Бекенд, API і формат налаштувань лишаються як були.

- **Сторінка налаштувань.** Прибираємо розділ `rules`: з переліку розділів, пошуку, опису й
  лічильника в змісті. З `MobileSettings` прибираємо форму й список правил разом із режимом
  `show="rules"`. Правила проєкту лишаються в JSON налаштувань UI-дерева: сторінка розбирає його
  й записує назад цілим, тому Save їх не губить (REQ-019-04).
- **Екран порівняння.** Список «Rules for this screen» уже показує правила обох областей
  (REQ-019-02), а Remove уже видаляє правило й перепорівнює знімок (REQ-019-03). Додаємо одне:
  Remove на правилі з областю `project` спершу відкриває діалог (MUI `Dialog`, як інші діалоги панелі) із селектором і поясненням,
  що правило діє на всі екрани (REQ-019-05). Правило для цього екрана видаляється одразу, як і
  зараз.
- **Специфікація 018.** Її вимоги 41, 42 і 45 звужуємо, а 51 знімаємо разом із тестом і
  `ruleSelectorError`. Номер 51 далі не використовуємо.

ADR не потрібен: рішення стосується лише інтерфейсу й не обмежує майбутню роботу.

## Компоненти

| Компонент | Шлях | Роль |
|---|---|---|
| Розділи налаштувань | `frontend/src/_helpers/projectSettings.helper.ts` | без розділу `rules`, без `elementRules` у `TREE_SECTION`, без `ruleSelectorError` |
| Сторінка налаштувань | `frontend/src/pages/ProjectSettingsPage.tsx` | без секції `rules`, її опису й лічильника |
| `MobileSettings` | `frontend/src/components/ProjectForm/ProjectForm.tsx` | лише налаштування знімків, без форми правил; `show` — `"all"` або `"mobile"` |
| Панель порівняння | `frontend/src/components/TestDetailsDialog/InsightsPanel.tsx` | підтвердження перед Remove правила для всіх екранів; `data-testid` для рядків правил і Remove |
| Тести налаштувань | `frontend/integration_tests/test/projectSettings.spec.ts`, `frontend/src/_helpers/projectSettings.helper.test.ts` | без розділу правил; Save зберігає правила проєкту |
| Тест правил у порівнянні | `frontend/integration_tests/test/elementRules.spec.ts` | новий: список, Remove, підтвердження |

## Дані

Без змін. Правила проєкту лишаються в налаштуваннях UI-дерева проєкту, правила перевірок — там,
де були. Міграцій немає.

## Потік

Remove на екрані порівняння:

1. Правило з областю This screen → запит на видалення → знімок перепорівнюється (як зараз).
2. Правило з областю All screens → діалог «Remove a rule for every screen?» із селектором →
   Cancel закриває діалог, нічого не змінюючи; Remove rule → той самий запит, що й у п. 1.

## Ризики

| Ризик | Що робимо |
|---|---|
| Save на сторінці налаштувань загубить правила проєкту, бо їх уже ніде не редагують | Playwright-тест перевіряє, що в тілі Save лишаються `elementRules` (REQ-019-04) |
| Правило проєкту, яке нічого не знаходить, ніде не видно | Список показує правила проєкту на кожному знімку, з «0 found» (REQ-019-02); це перевіряє тест |
| Пошук «rule» знаходить «Problem classes → Rules» у розділі доступності | Це інше поле, і воно лишається. Тест перевіряє лише, що розділу правил елементів серед результатів немає |

## Перевірка вимог

| Вимога | Перевірка |
|---|---|
| REQ-019-01 | `frontend/integration_tests/test/projectSettings.spec.ts › has no element rules section` |
| REQ-019-01 | `frontend/src/_helpers/projectSettings.helper.test.ts › finds settings by section or field name` |
| REQ-019-02 | `frontend/integration_tests/test/elementRules.spec.ts › lists the rules for this screen and for every screen` |
| REQ-019-03 | `frontend/integration_tests/test/elementRules.spec.ts › removes a rule for this screen at once` |
| REQ-019-04 | `frontend/integration_tests/test/projectSettings.spec.ts › keeps the project's element rules when saving` |
| REQ-019-05 | `frontend/integration_tests/test/elementRules.spec.ts › asks before removing a rule for every screen` |
