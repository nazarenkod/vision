# Чек-ліст доступності екрана Android

Що вимагає Google від доступного екрана і що з цього Vision перевіряє сама, а що лишається на
ручну перевірку з TalkBack і Switch Access. Читай, коли перевіряєш екран вручну або плануєш нове
правило доступності. Правила Vision і їхні пороги — у [003](../specs/003-accessibility-checks/spec.md).

Джерела зібрано 29.10.2026; у дужках — дата оновлення сторінки:

- [Core app quality guidelines](https://developer.android.com/docs/quality-guidelines/core-app-quality)
  (2026-10-20) — чек-ліст якості Google Play, ID пунктів на кшталт `Touch_Target_Size`;
- [Make apps more accessible](https://developer.android.com/guide/topics/ui/accessibility/apps) (2026-10-23);
- [Principles for improving app accessibility](https://developer.android.com/guide/topics/ui/accessibility/principles) (2026-10-23);
- [Compose: API defaults](https://developer.android.com/develop/ui/compose/accessibility/api-defaults) (2026-10-28);
- [Test your app's accessibility](https://developer.android.com/guide/topics/ui/accessibility/testing) (2026-10-23);
- [Compose: Testing](https://developer.android.com/develop/ui/compose/accessibility/testing) (2026-10-22);
- [Accessibility (design)](https://developer.android.com/design/ui/mobile/guides/foundations/accessibility) (2023-05-08).

## Що перевіряє Vision

✅ — правило є; ⚠️ — є, але поріг чи зміст відрізняється від Google; ❌ — правила немає.

| Вимога Google | Поріг | Vision | Примітка |
|---|---|---|---|
| Інтерактивний елемент має опис (`Content_Description`) | — | ✅ `missing-label` | `Text` опису не потребує: TalkBack читає текст |
| Зона тапу (`Touch_Target_Size`) | ≥ 48 × 48 dp | ✅ `touch-target` | iOS — 44 × 44 pt (HIG) |
| Зона тапу однакова на всіх розмірах екрана й конфігураціях | — | ❌ | вручну: той самий екран на кількох пристроях |
| Контраст тексту (`Visual_Contrast`) | 4,5 : 1; 3 : 1 для великого | ⚠️ `low-contrast` | у Google великий текст — від 18 sp або від 14 sp жирним; у Vision — від 28 dp заввишки й до 30 символів, бо розміру шрифту й жирності в дереві немає |
| Контраст графіки й нетекстових елементів (іконки, межі полів) | ≥ 3 : 1 | ❌ | кандидат на нове правило: міряється на скриншоті, як контраст тексту |
| Поле вводу має підпис | — | ⚠️ `input-without-label` | Google: `placeholder` — для прикладу вводу, підпис — окремо (`label`); Vision вважає підказку достатньою |
| Описи в списку унікальні | — | ✅ `duplicate-label` | |
| Опис без назви ролі («Submit», а не «Submit button») | — | ✅ `redundant-role` | порада, не проблема |
| Порядок обходу відповідає розкладці | — | ❌ | є в ATF і pre-launch report («Implementation»); вручну — TalkBack, нижче |
| Розмір основного тексту | ≥ 12 sp | ❌ | розміру шрифту в дереві Appium немає |
| Рядок тексту (`Line_Length`) | 45–75 символів | ❌ | вручну: немає обрізаних слів і переносів усередині кнопок |

Кнопки iOS, приховані від VoiceOver (`not-accessible`), — вимога Apple, а не Google.

## Вручну: TalkBack

Налаштування → Доступність → TalkBack. Щоб бачити, що озвучується: Advanced settings →
Developer settings → Log output level = VERBOSE і Display speech output.

- [ ] Озвучення кожного елемента передає його зміст або призначення.
- [ ] Озвучення коротке, без зайвого.
- [ ] Основні сценарії проходяться без зору.
- [ ] Свайпами можна дійти до кожного елемента.
- [ ] Порядок обходу відповідає тому, як екран читається очима.
- [ ] Сповіщення й тимчасові повідомлення (snackbar, toast, помилки) зачитуються.
- [ ] Декоративні елементи (іконка біля підписаного тексту, роздільники) TalkBack пропускає.
- [ ] Картка чи рядок списку з кількох текстів читається як один елемент.
- [ ] Підказка дії конкретна: «Double tap to open this article», а не «Double tap to activate».
- [ ] Заголовки розділів позначені як заголовки: між ними можна стрибати.
- [ ] Перемикачі, чекбокси, вкладки називають роль і стан («Switch, on»).

## Вручну: Switch Access

TalkBack вимкнено. Auto-scan вимкнено; «Next» — гучність униз, «Select» — гучність угору.

- [ ] Основні сценарії проходяться.
- [ ] Текст і інші поля вводу можна ввести й змінити.
- [ ] Підсвічуються лише елементи, з якими можна щось зробити, і кожен — один раз.
- [ ] Кожна дія жестом (свайп для видалення, перетягування) доступна кнопкою або дією
  доступності (`customActions`).

## Вручну: решта

- [ ] Посилання, помилки, обрані елементи відрізняються не лише кольором: формою, текстом,
  іконкою.
- [ ] Відео й аудіо: є пауза, гучність, субтитри; для відео, без якого не пройти сценарій, —
  текстова альтернатива.
- [ ] Voice Access (Android 5.0+): основні сценарії проходяться голосовими командами.

## Інструменти Google

| Інструмент | Що ловить | Коли |
|---|---|---|
| Accessibility Scanner | підписи, зони тапу, контраст — на запущеному застосунку | ручна перевірка на пристрої |
| Pre-launch report (Play Console → Accessibility) | зони тапу, контраст, підписи, порядок обходу | після завантаження в канал релізу |
| ATF у тестах Compose (від 1.8.0): `ui-test-junit4-accessibility`, `enableAccessibilityChecks()` | підписи, контраст, зони тапу, порядок обходу | в інструментальних тестах розробників |
| Compose UI Check (Android Studio) | контраст, розтягнутий текст на великих екранах, дальтонізм | у превʼю |

Accessibility Scanner, pre-launch report і перевірки Espresso та Compose працюють на одному
[Accessibility Test Framework](https://github.com/google/Accessibility-Test-Framework-for-Android).
