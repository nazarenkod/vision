# frontend — React 18 + MUI 5 + Vite

Загальні правила — у [../AGENTS.md](../AGENTS.md). Тут лише те, що стосується фронтенду.

## Де що

| Шлях | Що там |
|---|---|
| `src/theme.ts` | палітри світлої й темної тем, `tokens` (CSS-змінні), `motion` (тривалості, крива); кольори й тривалості беремо звідси, не літералами ([ADR-0015](../docs/decisions/0015-theme-tokens-as-css-variables.md)) |
| `src/contexts/themeMode.context.tsx` | вибір теми (System / Light / Dark), ⇧D, `useTokens()` — справжні кольори для canvas і бібліотек з inline-стилями |
| `src/components/BrandMark.tsx` | знак «Гніздо» і словесний знак; favicon — `public/favicon.svg`, PNG — `scripts/render-favicon.mjs` |
| `src/components/motion/` | `useCountUp`, `staggered(i)` (каскад), `GrowFromPointer` (діалоги ростуть з точки кліку), `SlidingToggleGroup` (замість `ToggleButtonGroup`: підсвітка переїжджає) |
| `src/pages/ProjectSettingsPage.tsx` | налаштування проєкту окремою сторінкою; розділи — у `components/ProjectForm/` |
| `src/i18n/` | мови інтерфейсу: словники `en.ts`/`uk.ts`, `useT()`, перемикач EN/UK у шапці |
| `src/constants/brand.ts` | назва продукту (Vision) і слоган — лише тут |
| `src/components/TestDetailsDialog/` | ревю скриншота: `InsightsPanel` (доступність, зміни), `JiraBugDialog`, `ReportBugDialog` і `BugEvidence` (баг із порівняння, [025](../docs/specs/025-bug-from-comparison/spec.md)), `DeviceStrip`; вибір елементів: `ElementPopover` (один; режим «Нестабільний текст», [033](../docs/specs/033-variable-text/spec.md), шматки й вирази — `_helpers/variableText.helper.ts`), `SelectionPanel` (2–3, [028](../docs/specs/028-several-elements/spec.md)), спільні дії й клавіші — `ElementActions` |
| `src/components/ProjectForm/` | налаштування проєкту, зокрема `A11yRulesSettings` (норми й увімкнені правила доступності, [026](../docs/specs/026-a11y-rules-settings/spec.md)) і `AllowedDevicesSettings` (дозволені пристрої, [029](../docs/specs/029-allowed-devices/spec.md)) |
| `src/components/BuildOverview/` | вкладка Overview збірки; `useBuildGroups` — групи змін для огляду й черг ([031](../docs/specs/031-build-overview/spec.md)) |
| `src/components/DeviceTags.tsx` | пристрій сірими тегами, модель першою, далі ОС, назва в підказці; `dense` для вузьких місць, `print` для звіту ([037](../docs/specs/037-device-as-tags/spec.md)). Новий показ пристрою — лише через нього |
| `src/components/SummaryParts.tsx` | плитки, картки й рядки таблиць огляду збірки; ними ж зібрано Accessibility (`A11ySummary`). Шапки MUI-таблиць і DataGrid, картки й їхні заголовки під них підігнані в `theme.ts`, тож нова таблиця виглядає так само без власних стилів |
| `src/_helpers/reviewQueue.helper.ts` | черги рев'ю: ключ у адресі (`queue`), порядок, пропуск вирішених, наступна черга; у порівнянні — `QueueHeader`, `QueueDone` |
| `src/components/BuildReport/`, `src/pages/ReportPage.tsx` | діалог звіту, `ReportDocument` (один для діалогу, друку й публічної сторінки); `/r/:token` без входу, `/report/:buildId` для друку |
| `src/pages/InsightsPage.tsx` | Insights |
| `src/services/*.service.ts` | виклики API: `fetch` + `authHeader()` + `handleResponse` (він же запам'ятовує `fileSignatures` знімків, `_helpers/fileSignatures.ts`; адресу знімка дає лише `staticService.getImage`, [043](../docs/specs/043-protected-images/spec.md)) |
| `src/types/` | типи; `insights.ts` дзеркалить відповіді бекенду для Vision-фіч |
| `public/cli/vision.py` | CLI і MCP (віддається UI за `/cli/vision.py`) |
| `integration_tests/` | Playwright: сторінки, моки API, скриншот-еталони |

## Команди

```bash
CI=true npx jest                       # unit-тести
npx tsc --noEmit -p .                  # відомі помилки апстріму — у scripts/baselines/; нових не додаємо
npx eslint <змінені файли>
npx prettier --write <змінені файли>   # НЕ `prettier --write src`: він переформатує чужі файли
npx playwright test <spec> --ignore-snapshots   # функціональні тести; у хмарі браузер дає hook сесії
./test-docker.sh --update-snapshots    # скриншот-еталони — лише в Docker (Linux)
```

## Правила

- Колір у `src/components` і `src/pages` — лише `tokens.*` або `useTokens()`: шістнадцятковий
  літерал там забороняє ESLint, бо він працює лише в одній темі.
- Рух — з `motion` у `theme.ts`; знімки в порівнянні після появи не рухаються (REQ-018-25).
- Тексти інтерфейсу — через `useT()` і ключі в `src/i18n/en.ts` + `uk.ts`
  ([ADR-0017](../docs/decisions/0017-interface-in-two-languages.md)): пропущений переклад —
  помилка `tsc`. Англійська — основна; тексти короткі й конкретні; дані (назви, id, повідомлення
  сервера) не перекладаємо. Чистий хелпер, що повертає текст, приймає `text` (типово `english`).
- Одиниця, яку рахують і переглядають, в інтерфейсі — «екран» / screen, а не «знімок», screenshot
  чи test run; у порівнянні нове зображення — «Поточний» / Current навпроти «Еталон»
  ([словник](../docs/product/glossary.md)).
- Нові елементи, які шукають тести, отримують `data-testid`.
- Скриншот-тести (`toHaveScreenshot`) на macOS не збігаються ніколи. Еталони генеруємо лише в
  Docker і лише тоді, коли змінився знятий екран. Перед заміною еталона переглядаємо отриманий
  знімок.
- Нове API — спершу тип у `src/types`, потім метод у сервісі, і лише тоді UI.

## Пастки

- Вкладка збірки й черга живуть в адресі (`tab`, `status`, `queue`; `testId` — останній). Хто
  відкриває прогін з вкладки, передає її в `buildTestRunLocation(…, { tab })`, інакше Esc
  поверне на Overview. Фікстура `openProjectPage` типово відкриває збірку на All tests.
- Playwright під час прогону переписує `public/env-config.js` на `localhost:4200`. Для
  локального дев-сервера поверни `REACT_APP_API_URL` на свій порт.
- `npm run test:pw:docker` монтує поточну папку в контейнер і ставить туди Linux-залежності.
  Запускай його в чистій копії репозиторію, інакше `node_modules` зміняться під Linux.
