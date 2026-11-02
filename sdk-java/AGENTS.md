# sdk-java — Java SDK

Загальні правила — у [../AGENTS.md](../AGENTS.md).

**Головне обмеження:** SDK — це upstream 4.3.1 плюс необов'язкові поля
`CheckOptions.uiTree` (XML page source; SDK стискає його gzip + base64) і `featureName` (назва фічі
для багів; не входить в ідентичність перевірки), а класи називаються `Vision`, `VisionConfig`,
`CheckOptions` і `CheckResult`. Будь-яка інша зміна API — лише за специфікацією, затвердженою
власником; запити до сервера лишаються сумісними, щоб еталони не скидались. Див.
[ADR-0024](../docs/decisions/0024-own-vision-sdk.md).

## Команди

```bash
gradle test                       # TestNG + MockHttpClient; потрібні JDK 11–17 і Gradle 7.x
../scripts/build-sdk-jar.sh       # jar і pom → dist/sdk-java/ (версія 4.3.1-vision.N)
```

## Правила

- Тест на кожну зміну запиту: перевіряємо JSON, який іде на сервер (`MockHttpClient`).
- Після зміни — перезібрати jar у `dist/sdk-java/` і оновити `dist/sdk-java/README.md`.
