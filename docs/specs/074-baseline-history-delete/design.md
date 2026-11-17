# 074 — Дизайн

## Підхід

`TestVariationDetailsPage.tsx`: підпис пари — звичайний `Typography` (`type.small`, 600) замість
`variant="overline"`, що перетворював текст на великі літери. Праворуч від «Baselines» у шапці —
кнопка «Delete» (`baselineDelete`, `color="error"`); підтвердження — `BaseModal` з тими ж ключами,
що на картці (`baselines.deleteTitle`, `deleteConfirm`, `deleteScope`), далі
`testVariationService.remove` (той самий `DELETE /test-variations/:id`), сповіщення й перехід на
`/variations/:projectId`. Бекенд не змінюється.

## Перевірка вимог

| Вимога | Перевірка |
|---|---|
| REQ-074-01 | `frontend/integration_tests/test/testVariationDetails.spec.ts › writes Selected and Previous as they are, not in capitals` |
| REQ-074-02 | `frontend/integration_tests/test/testVariationDetails.spec.ts › deletes the baseline from its history and goes back to the list` |
| REQ-074-03 | `frontend/integration_tests/test/testVariationDetails.spec.ts › keeps the baseline when its delete is cancelled` |
