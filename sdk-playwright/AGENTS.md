# sdk-playwright — SDK для Playwright

Загальні правила — у [../AGENTS.md](../AGENTS.md).

**Головне обмеження:** `@vision/sdk-playwright` — перенесений агент VRT `agent-playwright` 6.0.0
разом із потрібною частиною `sdk-js` 5.9.0 (без залежності від пакетів VRT): клас `VisionPlaywright`,
налаштування `VISION_*` і `vision.json`, як у Java SDK. Запити до сервера ті самі, що надсилає
`sdk-js` (`POST /builds`, `POST /test-runs/multipart`, `PATCH /builds/:id`, заголовки `apiKey` і
`project`, ті самі поля форми), плюс необов'язкові `uiTree`, `uiTreeFormat: 'web'`, `featureName`,
`browserVersion` ([050](../docs/specs/050-web-ui-tree/spec.md), REQ-050-21…25). Інші зміни API —
лише за специфікацією.

## Команди

```bash
npm ci
npm run build     # dist/ з .d.ts і копією ../web-tree/collect-tree.js
npm test          # збирає dist/ і проганяє @playwright/test (Chromium) проти нього
npm pack          # vision-sdk-playwright-<версія>.tgz для тестових проєктів
```

## Правила

- Скрипт збору дерева — лише `../web-tree/collect-tree.js`, спільний з Java SDK; збірка кладе його
  в `dist/` без змін, тест `uses the very script the Java SDK uses` звіряє побайтно. Не правити копію.
- Тест на кожну зміну запиту: перевіряємо поля, що отримує сервер (`test/mockServer.ts`).
- Збір дерева ніколи не валить тест: при помилці чи понад межу — знімок без дерева і `console.warn`.
- Файли, перенесені з VRT, мають у заголовку походження (Apache-2.0, див. `../NOTICE`).
