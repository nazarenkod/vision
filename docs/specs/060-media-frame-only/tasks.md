# 060 — Задачі

- [ ] **T1** (REQ-060-40, 42, 43, 45, 34) Налаштування й дії правила.
  - Файли: `backend/src/ui-tree/comparison-inputs.ts` (`UiTreeSettings.media`, розбір,
    `ElementRuleAction` + `frame`, `content`, `resolveRules` їх не обводить),
    `backend/src/test-runs/dto/element-rule.dto.ts`, `backend/src/ui-tree/comparison-inputs.spec.ts`.
  - Готово, коли: старі налаштування читаються з `media.enabled = true`; невірні, повторні й
    понад 50 селекторів відкинуто; DTO приймає `frame` і `content`.
- [ ] **T2** [P] (REQ-060-01) Веб: `UiNode.indeterminate` для `progress` без `value`.
  - Файли: `backend/src/ui-tree/ui-tree.types.ts`, `backend/src/ui-tree/web-tree.parser.ts`, його
    тест на фікстурі з `web-tree/make-fixtures.cjs`.
  - Готово, коли: тест парсера бачить `indeterminate` лише без `value`.
- [ ] **T3** (REQ-060-01…04, 11…15, 17, 19, 20, 34, 45) Чиста логіка медіа (після T1, T2).
  - Файли: новий backend/src/ui-tree/media-elements.ts і його тест.
  - Що в ньому: `BUILT_IN_MEDIA`, `mediaNodes`, `planMedia`, `mediaStatus`,
    `mediaContentChanged`.
  - Готово, коли: усі тести `media-elements.spec.ts` з «Перевірки вимог» зелені, зокрема
    повноекранний `SurfaceView`, `FlutterSurfaceView` і `ProgressBar`.
- [ ] **T4** (REQ-060-10, 16, 18, 21) Порівняння й статус (після T3).
  - Файли: `backend/src/ui-tree/ui-tree.service.ts` (`comparisonInputs` з гілкою без дерева
    знімка, `structure` з `contentChanged`), `backend/src/test-runs/test-runs.service.ts`
    (`mediaStatus`), `backend/src/test-runs/change-groups.service.ts`, їхні тести.
  - Готово, коли: кадр відео не відправляє на рев'ю, а зміна рамки відправляє.
    `structure.characterization` оновлено, і різницю переглянуто.
- [ ] **T5** [P] (REQ-060-26) Колір медіа.
  - Файли: `frontend/src/theme.ts`, `frontend/src/theme.test.ts`.
  - Готово, коли: `media`/`mediaSoft` є в обох палітрах із контрастом ≥ 3:1 до фону панелі.
- [ ] **T6** (REQ-060-27…31, 46) «Межі порівняння», перелік змін, схема, результат (після T4, T5).
  - Файли: `frontend/src/types/insights.ts`, `frontend/src/_helpers/whatsCompared.helper.ts`,
    `frontend/src/components/TestDetailsDialog/WhatsCompared.tsx`,
    `frontend/src/components/TestDetailsDialog/ComparedMap.tsx`,
    `frontend/src/components/TestDetailsDialog/changedAreas.ts`,
    `frontend/src/components/TestDetailsDialog/ComparisonVerdict.tsx`, i18n.
  - Готово, коли: unit-тести з «Перевірки вимог» зелені.
- [ ] **T7** (REQ-060-25, 32, 33, 35, 36, 46) Позначки на знімках і «Що перевіряти» (після T6).
  - Файли: `frontend/src/components/TestDetailsDialog/TestDetailsModal.tsx`,
    `frontend/src/components/TestDetailsDialog/ElementPopover.tsx`,
    `frontend/src/components/TestDetailsDialog/ElementActions.tsx`, i18n; новий Playwright
    frontend/integration_tests/test/mediaElements.spec.ts з моками API.
  - Готово, коли: тести `ElementPopover.test.tsx` і `mediaElements.spec.ts` зелені.
- [ ] **T8** [P] (REQ-060-40…43, 46) Розділ «Медіа-елементи» в налаштуваннях (після T1).
  - Файли: `frontend/src/components/ProjectForm/ProjectForm.tsx`, новий `MediaSettings.tsx`,
    i18n, `frontend/integration_tests/test/projectSettings.spec.ts`.
  - Готово, коли: тести налаштувань зелені; скриншот-еталони, якщо змінились, — лише в Docker.
- [ ] **T9** (REQ-060-50) Тексти обома мовами.
  - Готово, коли: `tsc` без пропущених перекладів і тест i18n зелений.
- [ ] **T10** Документація.
  - Статус spec → `Implemented`, рядки «Перевірки вимог» з «план:» стали справжніми тестами.
  - Позначки «Розширено 060» у рядках REQ-024-03, REQ-030-12, REQ-036-11, якщо `check-docs.py`
    цього вимагатиме.
  - У словник: «Медіа-елемент», «Лише рамка».
  - Рядок про `media-elements.ts` у `backend/AGENTS.md`, ADR-0031 → `Accepted`.
  - DEMO.md: перевірка з відео.
- [ ] **T11** `/verify`.
  - Тести, типи, лінт, еталони скриншотів, `scripts/check-docs.py`.
  - Сценарії приймання US-1…US-5 на стенді з Android-фікстурою з `VideoView`.
