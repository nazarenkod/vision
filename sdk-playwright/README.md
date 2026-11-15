# Vision для Playwright

`@vision/sdk-playwright` надсилає знімки з тестів Playwright у Vision разом із деревом сторінки
(UI-деревом вебу): де показано кожен елемент, що приховано, яку назву озвучить читач екрана. З
деревом Vision розрізняє зсуви, невидимі зміни й перевіряє доступність, як для мобільних знімків.

Це перенесений агент Visual Regression Tracker `agent-playwright` 6.0.0: ті самі методи й опції,
ті самі запити до сервера, тож еталони не скидаються. Пакетів VRT він не потребує. Node 18+,
Playwright 1.40+.

## Встановлення

Пакет не публікується в npm: його збирають із цього репозиторію.

```bash
cd sdk-playwright
npm ci
npm pack                 # → vision-sdk-playwright-1.0.0.tgz
```

У тестовому проєкті:

```bash
npm install --save-dev /path/to/vision-sdk-playwright-1.0.0.tgz
```

або покладіть архів у репозиторій тестів і пропишіть у `package.json`:
`"@vision/sdk-playwright": "file:vendor/vision-sdk-playwright-1.0.0.tgz"`.

## Налаштування

| Поле | Змінна | Обов'язкове | Що це |
|---|---|---|---|
| `apiUrl` | `VISION_APIURL` | так | адреса API Vision, напр. `http://vision:4200` |
| `project` | `VISION_PROJECT` | так | назва або ID проєкту |
| `apiKey` | `VISION_APIKEY` | так | API-ключ користувача |
| `branchName` | `VISION_BRANCHNAME` | так | поточна гілка |
| `sourceBranch` | `VISION_SOURCEBRANCH` | ні | гілка, з якої беруться еталони для нової гілки |
| `ciBuildId` | `VISION_CIBUILDID` | ні | ID збірки в CI |
| `enableSoftAssert` | `VISION_ENABLESOFTASSERT` | ні | `true`: писати в лог замість падіння тесту |
| `httpTimeoutInSeconds` | `VISION_HTTPTIMEOUTINSECONDS` | ні | час очікування відповіді, за замовчуванням 360, `0` — без меж |

Без явного `config` SDK читає `./vision.json` (ті самі поля), а змінні `VISION_*` мають перевагу над
файлом. З явним `config` файл і змінні не читаються, крім `VISION_SOURCEBRANCH`. Старі `VRT_*` і
`vrt.json` не читаються.

## Приклад

```ts
import { test, expect } from '@playwright/test';
import { VisionPlaywright } from '@vision/sdk-playwright';

const vision = new VisionPlaywright('chromium');

test.beforeAll(async () => {
  await vision.start();
});

test.afterAll(async () => {
  await vision.stop();
});

test('cart', async ({ page }) => {
  await page.goto('https://shop.example/cart');
  await vision.trackPage(page, 'Cart', {
    featureName: 'Checkout',
    diffTollerancePercent: 0.1,
    screenshotOptions: { fullPage: true },
  });
  await vision.trackElementHandle(page.locator('#total'), 'Cart total');
});
```

## Методи й опції

- `new VisionPlaywright(browserName, config?)` — `browserName` іде в поле `browser` знімка.
- `start()` / `stop()` — відкрити й закрити збірку.
- `trackPage(page, name, options?, retryCount = 2)` — знімок сторінки з деревом.
- `trackElementHandle(handle, name, options?, retryCount = 2)` — знімок елемента (`ElementHandle`
  або `Locator`), **без дерева**: пікселі знімка елемента не збігаються з координатами сторінки,
  тож дерево до нього не прив'язати.

Опції обох методів, як в агента VRT: `agent: { os, device, viewport }` (`viewport` — лише для
елемента; для сторінки він береться з `page.viewportSize()`), `customTags`, `diffTollerancePercent`,
`ignoreAreas`, `comment`, `screenshotOptions`. Нове у Vision:

- `featureName` — фіча, до якої належить екран; дає назву багам з рев'ю. В ідентичність перевірки
  не входить, тож еталони не змінюються.
- `uiTree` (лише `trackPage`) — за замовчуванням `true`: дерево збирається для того, що на знімку
  (уся сторінка з `screenshotOptions.fullPage`, інакше вікно). `'viewport'` чи `'page'` задають це
  явно, `false` — знімок без дерева.
- `browserVersion` береться сам із `page.context().browser()?.version()`.

Як і в `sdk-js`: знімок зі статусом `unresolved` надсилається ще до `retryCount` разів; `new` і
`unresolved` валять тест (`No baseline: …`, `Difference found: …`), якщо не ввімкнено
`enableSoftAssert`; `failed` лише пише попередження.

## Дерево сторінки

Дерево збирає той самий скрипт, що й Java SDK для Selenide (`web-tree/collect-tree.js`), у тій самій
сторінці одразу перед знімком. Воно стискається gzip і надсилається base64 у полі `uiTree` з
`uiTreeFormat: 'web'`. Якщо зібрати не вдалося (сторінка закрилась, скрипт зламала сторінка) або
дерево більше за 10 МиБ, знімок іде без дерева, а в лог тесту пишеться `Vision: no UI tree …` —
тест не падає. Так само без дерева йде знімок, чиє стиснене дерево більше за 1 МиБ: стільки
приймає одне поле форми на сервері.

## Перехід з `@visual-regression-tracker/agent-playwright`

1. Залежність: прибрати `@visual-regression-tracker/agent-playwright` (і `sdk-js`, якщо її додавали
   окремо), встановити `@vision/sdk-playwright` з архіву.
2. Код: `PlaywrightVisualRegressionTracker` → `VisionPlaywright`, імпорт з `@vision/sdk-playwright`.
   Методи й опції ті самі; тип `Config` теж експортується.
3. Налаштування: `VRT_APIURL` → `VISION_APIURL`, `VRT_PROJECT` → `VISION_PROJECT`, `VRT_APIKEY` →
   `VISION_APIKEY`, `VRT_BRANCHNAME` → `VISION_BRANCHNAME`, `VRT_SOURCEBRANCH` → `VISION_SOURCEBRANCH`,
   `VRT_CIBUILDID` → `VISION_CIBUILDID`, `VRT_ENABLESOFTASSERT` → `VISION_ENABLESOFTASSERT`,
   `VRT_HTTPTIMEOUTINSECONDS` → `VISION_HTTPTIMEOUTINSECONDS`; файл `vrt.json` → `vision.json`.
   Застарілий `baselineBranchName` (`VRT_BASELINEBRANCHNAME`) не підтримується: замість нього
   `sourceBranch`.
4. Повідомлення про помилки ті самі, лише «Visual Regression Tracker has not been started» тепер
   «Vision has not been started».

Еталони не скидаються: запити ті самі, нові поля сервер не враховує в ідентичності перевірки.

## Ліцензія

Apache-2.0 ([LICENSE](LICENSE)). Похідний від Visual Regression Tracker
(https://github.com/Visual-Regression-Tracker, copyright 2020-2025 Pavel Strunkin and contributors,
Apache-2.0): `agent-playwright` 6.0.0 і частина `sdk-js` 5.9.0, змінені для Vision.
