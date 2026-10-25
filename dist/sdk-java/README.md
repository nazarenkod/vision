# Vision Java SDK, ready-made jar

`sdk-java-4.3.1-vision.1.jar` is upstream sdk-java 4.3.1 plus one optional field,
`TestRunOptions.uiTree`. Same package and classes, runs on Java 11+. Rebuild with
`./scripts/build-sdk-jar.sh` (JDK 11–17, Gradle 7).

Add it to a Maven project in one of two ways.

## A. Install into the local Maven repository (recommended)

Keeps the dependencies (gson, slf4j) that the pom lists, so only `<version>` changes in your pom:

```bash
mvn install:install-file -Dfile=sdk-java-4.3.1-vision.1.jar -DpomFile=sdk-java-4.3.1-vision.1.pom
```

```xml
<dependency>
    <groupId>com.github.Visual-Regression-Tracker</groupId>
    <artifactId>sdk-java</artifactId>
    <version>4.3.1-vision.1</version>
</dependency>
```

Run the install once on every machine that builds the tests (your laptop, each CI agent).

## B. The jar inside your project

Put the jar into e.g. `libs/` of the test project and commit it. Then:

```xml
<dependency>
    <groupId>com.github.Visual-Regression-Tracker</groupId>
    <artifactId>sdk-java</artifactId>
    <version>4.3.1-vision.1</version>
    <scope>system</scope>
    <systemPath>${project.basedir}/libs/sdk-java-4.3.1-vision.1.jar</systemPath>
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
