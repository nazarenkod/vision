# 010 — AI на вимогу

- **Статус:** Implemented
- **Оновлено:** 2026-10-27
- **Пов'язане:** [ADR-0007](../../decisions/0007-deterministic-first-ai-on-demand.md)
- **Код:** `backend/src/ai/` (`ai.service.ts`, `ai-features.service.ts`, `image-crop.ts`), таблиця `AiResult`,
  змінні `AI_PROVIDER`, `AI_MODEL`, `GEMINI_API_KEY`, `OLLAMA_BASE_URL`, `AI_DAILY_CALL_LIMIT`

## Проблема

AI корисний для пояснення групи змін і для підписів іконок, але платні виклики на кожен знімок
дорогі. Локальна модель (Mac Studio M2) мусить бути легкою.

## Вимоги

| ID | Вимога |
|---|---|
| REQ-010-01 | СИСТЕМА ПОВИННА вимикати AI (і ховати його в UI), поки не задано провайдера (`gemini` / `ollama`) і його облікові дані. |
| REQ-010-02 | СИСТЕМА ПОВИННА викликати модель лише на вимогу з рев'ю і ніколи — під час прийому знімка. |
| REQ-010-03 | СИСТЕМА ПОВИННА робити один виклик на групу змін, а не на знімок. Для групи, яку пояснює UI-дерево, — лише текст; інакше — дві невеликі вирізки навколо змін. |
| REQ-010-04 | СИСТЕМА ПОВИННА відповідати на групи шуму правилами, без моделі. |
| REQ-010-05 | СИСТЕМА ПОВИННА кешувати кожну відповідь за вмістом запиту (`AiResult`) і питати знову лише при інших картинках. |
| REQ-010-06 | СИСТЕМА ПОВИННА зупиняти платні виклики на денному ліміті (`AI_DAILY_CALL_LIMIT`, типово 500). |
| REQ-010-07 | СИСТЕМА ПОВИННА пропонувати підписи для іконок без підпису мовою екрана. |

## Трасування

| Вимога | Перевірка (`backend/src/ai/ai.service.spec.ts`) |
|---|---|
| 01 | `› is off unless a provider and its credentials are set`, `› uses a local Ollama model when configured` |
| 03 | `› describes structural groups from text alone, keyed by the change`; `› crops with padding and shrinks to the size limit` |
| 04 | `› answers noise groups from the rules without calling the model` |
| 05 | `› calls the model once and serves the same question from the cache`, `› asks again when the images differ` |
| 06 | `› stops paid calls at the daily limit` |
| 02 | дизайн: прийом (`test-runs.service.ts`) не залежить від `AiModule` |
| 07 | manual: знімок з іконкою без підпису → «Suggest labels with AI» |
