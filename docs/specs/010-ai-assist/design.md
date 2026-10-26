# 010 — Дизайн

## Підхід

`AiService` — єдина точка доступу до моделі: провайдер (`AI_PROVIDER`), модель (`AI_MODEL`,
типово `gemini-flash-lite-latest`), кеш у `AiResult` за хешем запиту й картинок, денний ліміт
(`AI_DAILY_CALL_LIMIT`). `AiFeaturesService` формує запити: для групи — текст зі структурної зміни
або вирізки (`cropPng`); для шуму — відповідь з правил; для підписів — вирізки кнопок.

## Компоненти

| Компонент | Шлях | Роль |
|---|---|---|
| Доступ до моделі | `backend/src/ai/ai.service.ts` | провайдери Gemini/Ollama, кеш, ліміт |
| Функції | `backend/src/ai/ai-features.service.ts` | підсумок групи, підписи |
| Вирізки | `backend/src/ai/image-crop.ts` | `cropPng` з відступом і обмеженням розміру |
| API | `backend/src/ai/ai.controller.ts` | `GET /ai/status`, `POST /ai/group-summary`, `POST /ai/a11y-labels` |

## Перевірка вимог

| Вимога | Перевірка |
|---|---|
| REQ-010-01 | `backend/src/ai/ai.service.spec.ts › is off unless a provider and its credentials are set`; `backend/src/ai/ai.service.spec.ts › uses a local Ollama model when configured` |
| REQ-010-02 | manual: `backend/src/test-runs/test-runs.service.ts` не залежить від `AiModule`; прийом із `AI_PROVIDER=gemini` не пише в `AiResult` |
| REQ-010-03 | `backend/src/ai/ai.service.spec.ts › describes structural groups from text alone, keyed by the change` |
| REQ-010-08 | `backend/src/ai/ai.service.spec.ts › describes structural groups from text alone, keyed by the change`; `backend/src/ai/ai.service.spec.ts › crops with padding and shrinks to the size limit` |
| REQ-010-04 | `backend/src/ai/ai.service.spec.ts › answers noise groups from the rules without calling the model` |
| REQ-010-05 | `backend/src/ai/ai.service.spec.ts › calls the model once and serves the same question from the cache`; `backend/src/ai/ai.service.spec.ts › asks again when the images differ` |
| REQ-010-06 | `backend/src/ai/ai.service.spec.ts › stops paid calls at the daily limit` |
| REQ-010-07 | manual: знімок з іконкою без підпису → «Suggest labels with AI» → підпис мовою екрана |
