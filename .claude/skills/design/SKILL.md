---
name: design
description: Write design.md and tasks.md for an Approved Vision spec — use when a spec is approved and implementation is about to start.
argument-hint: <spec number, e.g. 013>
---

# Design → Tasks

Специфікація: $ARGUMENTS

1. Відкрий `docs/specs/$ARGUMENTS-*/spec.md`. Якщо статус не `Approved` або лишились
   `[ПОТРЕБУЄ УТОЧНЕННЯ]` — зупинись і назви, що заважає.
2. Прочитай ADR, на які посилається специфікація, `AGENTS.md` зачеплених пакетів і код, якого
   стосується зміна.
3. Напиши `design.md` за `docs/specs/_template/design.md`: підхід, компоненти з шляхами, дані
   (лише додавальні міграції, ADR-0003), потік, ризики, таблиця «Перевірка вимог», де кожна
   вимога має запланований тест або `manual:`.
4. Рішення з наслідками для майбутньої роботи — запропонуй ADR за `docs/decisions/template.md`.
5. Напиши `tasks.md` за шаблоном: малі задачі з посиланням на REQ і перевіркою; незалежні, що не
   чіпають тих самих файлів, познач `[P]`.
6. Покажи людині дизайн і задачі; реалізацію починай після її згоди.
