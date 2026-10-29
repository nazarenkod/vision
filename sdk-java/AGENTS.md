# sdk-java — Java SDK

Загальні правила — у [../AGENTS.md](../AGENTS.md).

**Головне обмеження:** SDK — це upstream 4.3.1 плюс **два** необов'язкові поля:
`TestRunOptions.uiTree` (XML page source; SDK стискає його gzip + base64) і `featureName` (назва фічі
для багів; не входить в ідентичність перевірки). Інших змін API не робимо: команди підключають
jar до наявних тестів і чекають, що решта працює як раніше. Сервер без їхньої підтримки поля
ігнорує. Див. [ADR-0019](../docs/decisions/0019-sdk-upstream-plus-ui-tree-and-feature.md).

## Команди

```bash
gradle test                       # TestNG + MockHttpClient; потрібні JDK 11–17 і Gradle 7.x
../scripts/build-sdk-jar.sh       # jar і pom → dist/sdk-java/ (версія 4.3.1-vision.N)
```

## Правила

- Тест на кожну зміну запиту: перевіряємо JSON, який іде на сервер (`MockHttpClient`).
- Після зміни — перезібрати jar у `dist/sdk-java/` і оновити `dist/sdk-java/README.md`.
