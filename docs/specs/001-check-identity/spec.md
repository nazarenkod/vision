# 001 — Перевірка за назвою, еталон на пристрій

- **Статус:** Implemented
- **Оновлено:** 2026-10-27
- **Пов'язане:** [ADR-0005](../../decisions/0005-check-by-name-baseline-per-device.md), [007](../007-cross-device-reference/spec.md)
- **Код:** `backend/src/ui-tree/comparison-inputs.ts` (`checkKey`, `sameDevice`),
  `frontend/src/components/TestDetailsDialog/DeviceStrip.tsx` (`runsOfCheck`), `TestVariationList.tsx` (`groupByCheck`)

## Проблема

В upstream ключ знімка — це назва + гілка + OS + браузер + viewport + пристрій. Один екран на
емуляторі й на BrowserStack-пристрої виглядає як дві непов'язані речі: правила й рішення
доводиться дублювати, а в рев'ю не видно, що це той самий екран.

## Вимоги

| ID | Вимога |
|---|---|
| REQ-001-01 | СИСТЕМА ПОВИННА вважати перевіркою назву тесту + `customTags`; пристрої (OS, пристрій, браузер, viewport) — прогони однієї перевірки. |
| REQ-001-02 | СИСТЕМА ПОВИННА зберігати окремий еталон для кожного пристрою перевірки (варіації upstream не змінюються), щоб піксельне порівняння лишалося точним. |
| REQ-001-03 | СИСТЕМА ПОВИННА показувати в рев'ю пристрої перевірки поруч і давати прийняти всі одним рішенням (Approve all). |
| REQ-001-04 | СИСТЕМА ПОВИННА прив'язувати правила елементів і рішення щодо доступності до перевірки, а не до одного пристрою. |
| REQ-001-05 | СИСТЕМА ПОВИННА групувати сторінку еталонів за перевірками. |
| REQ-001-06 | СИСТЕМА ПОВИННА групувати наявні дані за назвою, як вони є, без міграції. |

## Трасування

| Вимога | Перевірка |
|---|---|
| 01, 03 | `frontend/src/components/checkGrouping.test.ts › finds the same check on every device of the build…`, `› puts each check's devices on one card…` |
| 02 | дизайн: `TestVariation` не змінено; `backend/src/ui-tree/ui-tree.service.spec.ts › falls back to the reference device baseline…` |
| 04 | `backend/src/test-runs/test-runs.service.spec.ts › keeps a rule for this screen by check, so every device and branch gets it`; `ui-tree.service.spec.ts › joins the rules kept by check…` |
| 05, 06 | manual: сторінка Baselines на копії бази проду |
