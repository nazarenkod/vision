# Vision Java SDK, ready-made jar

`vision-sdk-1.0.0.jar` is `ua.vision:vision-sdk` 1.0.0: classes `Vision`, `VisionConfig`,
`VisionOptions`, `VisionResult` in the package `ua.vision.sdk`, settings from `VISION_*` or
`vision.json`, optional `uiTree` (up to 10 MiB; bigger is not sent) and `featureName`. Runs on
Java 11+. Rebuild with `./scripts/build-sdk-jar.sh` (JDK 11–17, Gradle 7).

Coming from `4.3.1-vision.N`: change the dependency, the imports `io.visual_regression_tracker.sdk_java.`
→ `ua.vision.sdk.`, the variables `VRT_*` → `VISION_*` and `vrt.json` → `vision.json`
([DEPLOY.md §7](../../DEPLOY.md)). Requests to the server are the same, baselines stay.

Add it to a Maven project in one of two ways.

## A. Install into the local Maven repository (recommended)

Keeps the dependencies (gson, slf4j) that the pom lists:

```bash
mvn install:install-file -Dfile=vision-sdk-1.0.0.jar -DpomFile=vision-sdk-1.0.0.pom
```

```xml
<dependency>
    <groupId>ua.vision</groupId>
    <artifactId>vision-sdk</artifactId>
    <version>1.0.0</version>
</dependency>
```

Run the install once on every machine that builds the tests (your laptop, each CI agent).

## B. The jar inside your project

Put the jar into e.g. `libs/` of the test project and commit it. Then:

```xml
<dependency>
    <groupId>ua.vision</groupId>
    <artifactId>vision-sdk</artifactId>
    <version>1.0.0</version>
    <scope>system</scope>
    <systemPath>${project.basedir}/libs/vision-sdk-1.0.0.jar</systemPath>
</dependency>
<!-- a system jar brings no dependencies of its own -->
<dependency>
    <groupId>com.google.code.gson</groupId>
    <artifactId>gson</artifactId>
    <version>2.9.0</version>
</dependency>
<dependency>
    <groupId>org.slf4j</groupId>
    <artifactId>slf4j-api</artifactId>
    <version>1.7.25</version>
</dependency>
```

Works everywhere without an install step; Maven prints a warning about the system scope.
If the project already has gson and slf4j-api, keep its own versions and drop those two.
