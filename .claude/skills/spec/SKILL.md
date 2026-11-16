---
name: spec
description: Write or update a Vision feature specification (spec.md) — use when a new feature or a change of behaviour is requested, before any design or code.
argument-hint: <what is needed and why, or the number of an existing spec>
---

# Specify

Задача: $ARGUMENTS

1. Прочитай `docs/specs/README.md` (правила, статуси, EARS) і `docs/product/glossary.md`.
2. Знайди специфікацію, яку це зачіпає (`docs/specs/NNN-*/spec.md`). Для нової фічі скопіюй
   `docs/specs/_template/spec.md` у `docs/specs/NNN-коротка-назва/spec.md` з наступним номером.
3. Заповни: контекст і проблему; історії (пріоритет, незалежна перевірка, сценарії «Дано/коли/
   тоді»); вимоги EARS з ID `REQ-NNN-NN` і посиланням на історію; граничні випадки; сутності;
   вимірювані критерії успіху; припущення; поза межами.
4. Жодних деталей реалізації (файлів, таблиць, бібліотек): вони підуть у `design.md`.
5. Невідоме — маркер `[ПОТРЕБУЄ УТОЧНЕННЯ: питання]`, а не припущення.
5a. Змінюєш чи знімаєш вимогу старішої специфікації — назви її в «Пов'язане»: «змінює [NNN]
   REQ-…» або «знімає [NNN] REQ-…» з посиланням на її spec.md. Коли зміна реалізована, допиши в
   рядок старої вимоги «Замінено РРРР-ММ-ДД [NNN] REQ-…: що тепер» або «Знято РРРР-ММ-ДД [NNN]:
   чому» (теж з посиланням) і онови її сценарії приймання та граничні випадки. `check-docs.py`
   перевіряє позначки.
6. Статус `Draft`; додай рядок у таблицю `docs/specs/README.md`; пройди чекліст якості в кінці
   шаблону; запусти `python3 -I scripts/check-docs.py`.
7. Покажи людині вимоги й питання. Код не пиши.
