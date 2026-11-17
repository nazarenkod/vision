# 068 — Дизайн

## Підхід

Фіча стає властивістю еталона: nullable-колонка `TestVariation.featureName`, яку прийом знімка
оновлює чистою функцією `featureToKeep` (непорожня надіслана назва замінює збережену, порожня — ні).
Список еталонів (`GET /test-variations`) уже віддає рядки цілком, тож фіча доходить до інтерфейсу
без нового маршруту. Групи, порядок і сторінки рахує чиста функція `baselineSections` у фронтенді;
`TestVariationList` лише малює секції: фіча — рамка із заголовком, картки без фічі — звичайна сітка
після рамок.

**Чому не чіпаємо `updatedAt` еталона.** `TestVariationsService.find` вибирає між еталоном гілки й
еталоном основної гілки за `updatedAt`. Якби запис фічі зсував цю дату, нова назва фічі могла б
змінити, з чим порівнюється знімок (порушення REQ-068-12). Тому запис фічі передає `updatedAt`
явно, тим самим значенням.

**REQ-068-07 через дату еталона.** Коли пристрої однієї картки мають різні фічі, картка йде у фічу
пристрою з найновішим `updatedAt` еталона: момент останнього знімка в еталоні не зберігається, а
окрема колонка лише для рідкісного розходження не варта своєї ціни. Формулювання вимоги уточнено.

## Компоненти

| Компонент | Шлях | Роль |
|---|---|---|
| `featureToKeep` | `backend/src/test-variations/variation-feature.ts` | яку назву фічі лишити за еталоном (REQ-068-01, 02) |
| `TestVariationsService.keepFeature` | `backend/src/test-variations/test-variations.service.ts` | записує фічу в еталон своєї гілки, не зсуваючи `updatedAt`; викликають прийом знімка (`TestRunsService.postTestRun`) і злиття гілок |
| `TestRunsService.approve` | `backend/src/test-runs/test-runs.service.ts` | еталон гілки, створений при затвердженні, бере фічу знімка |
| `TestVariationsService.create` | `backend/src/test-variations/test-variations.service.ts` | новий еталон (і злиття гілок, що розгортає еталон у запит) — з фічею запиту |
| DTO | `backend/src/test-variations/dto/base-test-variation.dto.ts` | поле `featureName` у відповіді й оновленні |
| міграція | `backend/prisma/migrations/20261117120000_add_variation_feature_name/migration.sql` | колонка і заповнення старих еталонів (REQ-068-03) |
| `baselineSections`, `featureOfCheck`, `matchesBaselineQuery` | `frontend/src/_helpers/baselineSections.helper.ts` | групи, порядок, сторінки, пошук (REQ-068-04…08, 11, 13) |
| `TestVariationList` | `frontend/src/components/TestVariationList.tsx` | рамка фічі з заголовком, сітка карток без фічі |
| `TestVariationListPage` | `frontend/src/pages/TestVariationListPage.tsx` | фільтр «Фіча», пошук, сторінки за секціями |
| `Filters` | `frontend/src/components/Filters.tsx` | необов'язковий фільтр `featureState` (REQ-068-10) |
| словники | `frontend/src/i18n/en.ts`, `frontend/src/i18n/uk.ts` | «Feature» / «Фіча», «N checks» у заголовку групи |

## Дані

`TestVariation.featureName String?` — nullable-колонка ([ADR-0003](../../decisions/0003-additive-schema-only.md)),
не входить в `@@unique`, тож ідентичність перевірки не змінюється. Міграція в тому самому файлі
заповнює лише нову колонку: для кожного еталона — назва фічі найновішого знімка цього еталона на його
гілці з непорожньою фічею. Існуючі колонки не змінюються, `updatedAt` теж (UPDATE явно не чіпає його,
а `@updatedAt` — це логіка Prisma, не тригер бази). Еталони без жодного такого знімка лишаються з
`NULL` — звичайна картка.

## Потік

1. Знімок приходить → `find` повертає еталон гілки або основної гілки.
2. Еталон своєї гілки й `featureToKeep` дає іншу назву → `update { featureName, updatedAt: той самий }`.
   Еталон основної гілки для знімка з іншої гілки не чіпаємо: у цієї гілки свого еталона ще немає.
3. Затвердження на гілці створює її еталон → фіча переходить зі знімка разом з областями й правилами.
4. Сторінка «Еталони»: фільтри й пошук → `groupByCheck` → `baselineSections(checks, page, size)` →
   рамки фіч за абеткою, потім картки без фічі.

## Ризики

| Ризик | Що робимо |
|---|---|
| Запис фічі змінює вибір еталона через `updatedAt` | явне `updatedAt`; тест на `postTestRun` |
| Заповнення у міграції повільне на великій базі | один `UPDATE` з підзапитом за індексом `testVariationId`; міграція йде на копії даних (правило 1) |
| Скриншоти Playwright сторінки еталонів змінюються | фікстури отримують фічу; еталони скриншотів оновлюються в `/verify` |

## Перевірка вимог

| Вимога | Перевірка |
|---|---|
| REQ-068-01 | `backend/src/test-variations/variation-feature.spec.ts › takes the feature the test sent` |
| REQ-068-02 | `backend/src/test-variations/variation-feature.spec.ts › keeps the stored feature when the test sent none` |
| REQ-068-03 | `manual: після міграції на копії даних еталон перевірки, що мала знімки з фічею, показується в групі цієї фічі` |
| REQ-068-04 | `frontend/src/_helpers/baselineSections.helper.test.ts › puts the checks of a feature in its section with the count` |
| REQ-068-05 | `frontend/src/_helpers/baselineSections.helper.test.ts › orders features by name ignoring case` |
| REQ-068-06 | `frontend/src/_helpers/baselineSections.helper.test.ts › has no sections when no check has a feature` |
| REQ-068-07 | `frontend/src/_helpers/baselineSections.helper.test.ts › takes the feature of the device updated last` |
| REQ-068-08 | `frontend/src/_helpers/baselineSections.helper.test.ts › repeats a section split by a page with its whole count` |
| REQ-068-09 | `frontend/src/components/TestVariationList.test.tsx › shows a feature as a framed section with no collapse` |
| REQ-068-10 | `frontend/src/components/TestVariationList.test.tsx › offers the feature filter` |
| REQ-068-11 | `frontend/src/_helpers/baselineSections.helper.test.ts › finds every check of a feature whose name holds the query` |
| REQ-068-12 | `backend/src/test-variations/test-variations.service.spec.ts › keeps the baseline date when it stores the feature` |
| REQ-068-13 | `frontend/src/_helpers/baselineSections.helper.test.ts › puts checks without a feature after the sections, in no section` |
