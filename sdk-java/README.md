# Vision Java SDK

`ua.vision:vision-sdk` sends screenshots, and optionally the screen's UI tree, from autotests to
Vision. Runs on Java 11+; build with JDK 11–17 and Gradle 7.

## Get it

A ready jar and pom are in `dist/sdk-java/` of this repository (`./scripts/build-sdk-jar.sh`
rebuilds them). Install into the local Maven repository:

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

Or publish from this folder:

```bash
gradle publishToMavenLocal
```

```bash
gradle publish -PrepoUrl=https://nexus.company/repository/maven-releases/ -PrepoUser=USER -PrepoPassword=PASSWORD
```

`-PpublishGroup=...` and `-PpublishVersion=...` change the coordinates.

## Usage

### Configuration
In order to initialize Vision, following options should be defined:

* `apiUrl` (**Required**) - URL where backend is running. _Example_: "http://localhost:4200"
* `project` (**Required**) - Project name or ID. _Example_: "003f5fcf-6c5f-4f1f-a99f-82a697711382"
* `apiKey` (**Required**) - User apiKey. _Example_: "F5Z2H0H2SNMXZVHX0EA4YQM1MGDD"
* `branch` (Optional) - Current git branch. _Example_: "develop"
* `enableSoftAssert` (Optional) - Log errors instead of exceptions. Default value is false
* `ciBuildId` (Optional) - id of the build in CI system
* `httpTimeoutInSeconds` (Optional) - define http socket timeout in seconds. Default value is 10 seconds

 There are a few ways to provide those options

<details>

<summary>Create config with builder</summary>

```java
VisionConfig config = VisionConfig.builder()
                .apiUrl("http://localhost:4200")
                .apiKey("F5Z2H0H2SNMXZVHX0EA4YQM1MGDD")
                .project("003f5fcf-6c5f-4f1f-a99f-82a697711382")
                .enableSoftAssert(true)
                .branchName("develop")
                .build();
```

</details>

<details>

<summary>Set environment variables</summary>

```
export VISION_APIURL=http://localhost:4200
export VISION_APIKEY=F5Z2H0H2SNMXZVHX0EA4YQM1MGDD
export VISION_PROJECT=003f5fcf-6c5f-4f1f-a99f-82a697711382
export VISION_BRANCHNAME=develop
export VISION_ENABLESOFTASSERT=true
export VISION_CIBUILDID=40bdba4
export VISION_HTTPTIMEOUTINSECONDS=15

```

</details>

<details>

<summary>Create vision.json file in the root of the project</summary>

```json
{
  "apiUrl": "[http://162.243.161.172:4200](http://localhost:4200)",
  "project": "003f5fcf-6c5f-4f1f-a99f-82a697711382",
  "apiKey": "F5Z2H0H2SNMXZVHX0EA4YQM1MGDD",
  "branchName": "develop",
  "enableSoftAssert": false,
  "ciBuildId": "40bdba4"
}

```

</details>

> [!NOTE]
> Final values, that will be used by Vision, will be resolved as following:
> 1. If explicitly set while creating `VisionConfig` - use this value
> 2. Use value from environment variable if it exists
> 3. Try to get it from the configuration file

<br />


### Create an instance of `Vision`

```java
Vision vision = new Vision(config);
```

or

```java
Vision vision = new Vision();
```

> [!TIP]
> If config is not provided explicitly, it will be created based on the environment variables or configuration file. Please see [Configuration](README.md#configuration) section

<br />

### Start `Vision`

```java
vision.start();
```

At that point Vision will try to create a new build for provided project. All of the subsequent tracked screenshots are going to be included in that build.

<br />

### Take a screenshot as String in Base64 format

```java
// Selenium example
String screenshotBase64 = ((TakesScreenshot) driver).getScreenshotAs(OutputType.BASE64);
```

<br />

### Track image

Default options

```java
vision.track(
        "Name for test",
        screenshotBase64
);
```

With specific options 

```java
vision.track(
        "Name for test",
        screenshotBase64,
        VisionOptions.builder()
            .browser("Chrome")
            .os("Windows")
            .viewport("1200x800")
            .diffTollerancePercent(3.0f)
            .build()
);
```

With the screen's UI tree (Appium page source; optional, Vision only)

```java
vision.track(
        "Payment",
        screenshotBase64,
        VisionOptions.builder()
            .device("Pixel 7")
            .os("Android 15")
            .uiTree(driver.getPageSource())
            .featureName("Checkout") // optional: names bugs filed from the review
            .build()
);
```

Vision then checks accessibility (labels, touch targets, contrast), tells
which element changed, and can ignore or tolerate changes by element. The
format (Android or iOS) is recognised from the XML. A tree over 10 MiB is not
sent: the SDK logs a warning and the screenshot goes without it.

A Vision project may list the devices its tests run on. A snapshot from any
other `device` / `os` is refused by the server, and `track` throws a
`TestRunException` with the reason, soft assert or not; no baseline is made.


### Stop `Vision`

```java
vision.stop();
```

Should be called once current build should be considered as completed.
