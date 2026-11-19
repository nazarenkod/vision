<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./docs/assets/logo-dark.png">
    <img src="./docs/assets/logo-light.png" width="300" alt="Vision">
  </picture>
</p>

<h3 align="center">Doesn't just see screens. Understands them.</h3>

<p align="center">
  Self-hosted візуальні перевірки для мобільних застосунків і вебу.
</p>

<p align="center">
  <a href="#швидкий-старт">Швидкий старт</a> ·
  <a href="#sdk">SDK</a> ·
  <a href="docs/README.md">Документація</a>
</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./docs/assets/screenshots/review-dark.png">
    <img src="./docs/assets/screenshots/review-light.png" alt="Рев'ю екрана у Vision">
  </picture>
</p>

## Як це працює

1. Автотест надсилає знімок екрана разом з його UI-деревом.
2. Vision порівнює його з еталоном і показує, які саме елементи змінились.
3. Ви приймаєте або відхиляєте зміни, а проблеми заводите в Jira.

## Можливості

- Порівняння за елементами, без шуму від годинника, анімацій і зсувів
- Одне рішення на однакову зміну в усіх екранах
- Перевірки доступності
- Баги в Jira без дублів
- Insights: нестабільні екрани й застарілі еталони
- Ручні перевірки з CLI та MCP
- LDAP / SSO, доступ до проєктів, світла й темна теми, EN / UK

## Швидкий старт

```sh
cp .env.demo.example .env.demo     # задайте JWT_SECRET, VISION_SECRET_KEY і DEFAULT_USER_PASSWORD
./scripts/vision.sh up -d --build
```

Відкрийте http://localhost:18080 і увійдіть як `admin@vision.local` з паролем із `DEFAULT_USER_PASSWORD`
(щонайменше 12 символів; без нього перший адміністратор не створюється).
Повне розгортання — у [DEPLOY.md](DEPLOY.md).

## SDK

- **Java** (Appium, Selenide) — [sdk-java](sdk-java/README.md)
- **Playwright** — [sdk-playwright](sdk-playwright/README.md)
- **CLI і MCP** для ручних перевірок — [vision.py](frontend/public/cli/vision.py)
- **REST API** — Swagger на `<API>/api`

```java
Vision vision = new Vision();
vision.start();
vision.track("Checkout", screenshot, VisionOptions.builder()
        .uiTree(driver.getPageSource())
        .build());
vision.stop();
```

## Ліцензія

[Apache-2.0](LICENSE)
