# sdk-java — Java SDK

Загальні правила — у [../AGENTS.md](../AGENTS.md).

**Головне обмеження:** SDK — `ua.vision:vision-sdk`, пакет `ua.vision.sdk`: upstream 4.3.1 плюс
необов'язкові поля `VisionOptions.uiTree` (XML page source; SDK стискає його gzip + base64 і не
надсилає понад 10 МиБ) і `featureName` (назва фічі для багів; не входить в ідентичність перевірки),
класи `Vision`, `VisionConfig`, `VisionOptions`, `VisionResult`, налаштування `VISION_*` і
`vision.json`. Будь-яка інша зміна API — лише за специфікацією, затвердженою власником; запити до
сервера лишаються сумісними, щоб еталони не скидались. Див.
[ADR-0024](../docs/decisions/0024-own-vision-sdk.md), [ADR-0026](../docs/decisions/0026-sdk-own-package-and-versions.md).

## Команди

```bash
gradle test                       # TestNG + MockHttpClient; потрібні JDK 11–17 і Gradle 7.x
../scripts/build-sdk-jar.sh       # jar і pom → dist/sdk-java/ (версія з build.gradle, зараз 1.0.0)
```

## Правила

- Тест на кожну зміну запиту: перевіряємо JSON, який іде на сервер (`MockHttpClient`).
- Готового jar у репозиторії немає: його збирає `scripts/build-sdk-jar.sh` у `dist/sdk-java/`
  (git його ігнорує). Як перейти на нову версію — `DEPLOY.md` §7.
