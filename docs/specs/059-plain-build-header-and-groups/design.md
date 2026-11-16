# 059 — Дизайн

## Підхід

`BuildDetails` більше не малює смугу статусів (і не рахує частки); `LinearProgress` для збірки, що
триває, лишається (REQ-059-01). Ключ перекладу `builds.statusBar` прибрано разом зі смугою.

У `ChangeGroups` мініатюру `Thumb` замінено рядком `ScreenRow` (`data-testid="groupScreen"`): та
сама кнопка з тим самим `aria-label` («Open …»), тож відкриття екрана й тести на нього не змінились;
назва екрана — коли група охоплює кілька екранів (REQ-059-02).

## Компоненти

| Компонент | Шлях | Роль |
|---|---|---|
| `BuildDetails` | `frontend/src/components/BuildDetails.tsx` | шапка збірки без смуги статусів |
| `ScreenRow` | `frontend/src/components/ChangeGroups.tsx` | рядок екрана групи змін |

## Дані

Без змін.

## Ризики

| Ризик | Що робимо |
|---|---|
| Скриншот-еталони сторінки проєкту зі смугою й мініатюрами | перегенерувати в Docker |

## Перевірка вимог

| Вимога | Перевірка |
|---|---|
| REQ-059-01 | `frontend/integration_tests/test/buildOverview.spec.ts › keeps the counts and the status bar out of the build header on every tab`; `manual: збірка, що триває, — під шапкою лінія прогресу` |
| REQ-059-02 | `frontend/integration_tests/test/projec.spec.ts › lists a group's screens as rows without pictures, and a row opens its screen` |
