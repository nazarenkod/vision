# frontend — React 18 + MUI 5 + Vite

Загальні правила — у [../AGENTS.md](../AGENTS.md). Тут лише те, що стосується фронтенду.

## Де що

| Шлях | Що там |
|---|---|
| `src/theme.ts` | токени кольорів і теми; кольори беремо звідси, не літералами |
| `src/constants/brand.ts` | назва продукту (Vision) і слоган — лише тут |
| `src/components/TestDetailsDialog/` | ревю скриншота: `InsightsPanel` (доступність, зміни, пристрої), `JiraBugDialog`, `DeviceStrip`, `CrossDevicePanel` |
| `src/components/ProjectForm/` | налаштування проєкту, зокрема `A11yProblemSettings` (класи проблем) |
| `src/pages/InsightsPage.tsx` | Insights |
| `src/services/*.service.ts` | виклики API: `fetch` + `authHeader()` + `handleResponse` |
| `src/types/` | типи; `insights.ts` дзеркалить відповіді бекенду для Vision-фіч |
| `public/cli/vision.py` | CLI і MCP (віддається UI за `/cli/vision.py`) |
| `integration_tests/` | Playwright: сторінки, моки API, скриншот-еталони |

## Команди

```bash
CI=true npx jest                       # unit-тести
npx tsc --noEmit -p .                  # базова лінія: 25 помилок апстріму; нових не додаємо
npx eslint <змінені файли>
npx prettier --write <змінені файли>   # НЕ `prettier --write src`: він переформатує чужі файли
npx playwright test <spec>             # функціональні тести, локально
./test-docker.sh --update-snapshots    # скриншот-еталони — лише в Docker (Linux)
```

## Правила

- Інтерфейс англійською, тексти короткі й конкретні.
- Нові елементи, які шукають тести, отримують `data-testid`.
- Скриншот-тести (`toHaveScreenshot`) на macOS не збігаються ніколи. Еталони генеруємо лише в
  Docker і лише тоді, коли змінився знятий екран. Перед заміною еталона переглядаємо отриманий
  знімок.
- Нове API — спершу тип у `src/types`, потім метод у сервісі, і лише тоді UI.

## Пастки

- Playwright під час прогону переписує `public/env-config.js` на `localhost:4200`. Для
  локального дев-сервера поверни `REACT_APP_API_URL` на свій порт.
- `npm run test:pw:docker` монтує поточну папку в контейнер і ставить туди Linux-залежності.
  Запускай його в чистій копії репозиторію, інакше `node_modules` зміняться під Linux.
