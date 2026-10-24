package io.visual_regression_tracker.sdk_java;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import io.visual_regression_tracker.sdk_java.response.A11ySummary;
import io.visual_regression_tracker.sdk_java.response.TestRunResponse;
import lombok.SneakyThrows;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import org.openqa.selenium.Capabilities;
import org.openqa.selenium.HasCapabilities;
import org.openqa.selenium.OutputType;
import org.openqa.selenium.TakesScreenshot;
import org.openqa.selenium.WebDriver;
import org.testng.annotations.AfterMethod;
import org.testng.annotations.BeforeMethod;
import org.testng.annotations.Test;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.zip.GZIPInputStream;

import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.CoreMatchers.nullValue;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.withSettings;

public class A11yTrackingTest {

    private static final String XML = "<hierarchy width=\"1080\"><android.widget.Button text=\"Pay\"/></hierarchy>";

    private final Gson gson = new Gson();
    private MockWebServer server;

    @SneakyThrows
    @BeforeMethod
    public void setup() {
        server = new MockWebServer();
        server.start();
    }

    @SneakyThrows
    @AfterMethod
    public void tearDown() {
        server.shutdown();
    }

    private VisualRegressionTracker tracker(boolean failOnNewA11yIssues, boolean softAssert) {
        VisualRegressionTrackerConfig config = new VisualRegressionTrackerConfig(
                server.url("/").toString(), "key", "project", "develop", null, softAssert, 5, failOnNewA11yIssues);
        VisualRegressionTracker vrt = new VisualRegressionTracker(config);
        vrt.buildId = "build";
        vrt.projectId = "projectId";
        return vrt;
    }

    private void respond(TestRunStatus status, A11ySummary a11y) {
        TestRunResponse response = TestRunResponse.builder()
                .status(status)
                .url("https://vrt/test/1")
                .a11y(a11y)
                .build();
        server.enqueue(new MockResponse().setBody(gson.toJson(response)));
    }

    @SneakyThrows
    private static String gunzipBase64(String value) {
        try (GZIPInputStream in = new GZIPInputStream(new ByteArrayInputStream(Base64.getDecoder().decode(value)))) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    @SneakyThrows
    private JsonObject sentBody() {
        RecordedRequest request = server.takeRequest();
        return gson.fromJson(request.getBody().readUtf8(), JsonObject.class);
    }

    @Test
    public void sendsTheUiTreeCompressed() throws Exception {
        respond(TestRunStatus.OK, null);

        tracker(false, false).track("Payment", "image", TestRunOptions.builder()
                .uiTree(XML)
                .uiTreeFormat("appium-android")
                .deviceDensity(420)
                .build());

        JsonObject body = sentBody();
        assertThat(gunzipBase64(body.get("uiTree").getAsString()), is(XML));
        assertThat(body.get("uiTreeFormat").getAsString(), is("appium-android"));
        assertThat(body.get("deviceDensity").getAsInt(), is(420));
    }

    @Test
    public void leavesTheNewFieldsOutWhenNotSet() throws Exception {
        respond(TestRunStatus.OK, null);

        tracker(false, false).track("Payment", "image");

        JsonObject body = sentBody();
        assertThat(body.has("uiTree"), is(false));
        assertThat(body.has("uiTreeFormat"), is(false));
        assertThat(body.has("deviceDensity"), is(false));
    }

    @Test
    public void tracksScreenshotAndPageSourceFromAnAppiumDriver() throws Exception {
        WebDriver driver = mock(WebDriver.class,
                withSettings().extraInterfaces(TakesScreenshot.class, HasCapabilities.class));
        Capabilities capabilities = mock(Capabilities.class);
        when(((TakesScreenshot) driver).getScreenshotAs(OutputType.BASE64)).thenReturn("c2NyZWVu");
        when(driver.getPageSource()).thenReturn(XML);
        when(((HasCapabilities) driver).getCapabilities()).thenReturn(capabilities);
        when(capabilities.getCapability("platformName")).thenReturn("ANDROID");
        when(capabilities.getCapability("appium:deviceScreenDensity")).thenReturn(440L);
        respond(TestRunStatus.OK, new A11ySummary(0, 3, "https://vrt/test/1"));

        TestRunResult result = tracker(false, false)
                .trackDriver(driver, "Payment", TestRunOptions.builder().device("Pixel 7").build());

        JsonObject body = sentBody();
        assertThat(body.get("imageBase64").getAsString(), is("c2NyZWVu"));
        assertThat(gunzipBase64(body.get("uiTree").getAsString()), is(XML));
        assertThat(body.get("uiTreeFormat").getAsString(), is("appium-android"));
        assertThat(body.get("deviceDensity").getAsInt(), is(440));
        assertThat(body.get("device").getAsString(), is("Pixel 7"));
        assertThat(result.getTestRunResponse().getA11y().getTotalCount(), is(3));
    }

    @Test
    public void optionsOverrideWhatTheDriverReports() throws Exception {
        WebDriver driver = mock(WebDriver.class, withSettings().extraInterfaces(TakesScreenshot.class));
        when(((TakesScreenshot) driver).getScreenshotAs(OutputType.BASE64)).thenReturn("c2NyZWVu");
        when(driver.getPageSource()).thenReturn(XML);
        respond(TestRunStatus.OK, null);

        tracker(false, false).trackDriver(driver, "Payment", TestRunOptions.builder()
                .uiTreeFormat("appium-ios")
                .build());

        JsonObject body = sentBody();
        assertThat(body.get("uiTreeFormat").getAsString(), is("appium-ios"));
        assertThat(body.has("deviceDensity"), is(false));
    }

    @Test(expectedExceptions = TestRunException.class,
            expectedExceptionsMessageRegExp = "New accessibility issues \\(2\\): https://vrt/test/1")
    public void failsOnNewAccessibilityIssuesWhenAsked() throws Exception {
        respond(TestRunStatus.OK, new A11ySummary(2, 5, "https://vrt/test/1"));
        tracker(true, false).track("Payment", "image");
    }

    @Test
    public void onlyLogsNewAccessibilityIssuesWithSoftAsserts() throws Exception {
        respond(TestRunStatus.OK, new A11ySummary(2, 5, "https://vrt/test/1"));
        TestRunResult result = tracker(true, true).track("Payment", "image");
        assertThat(result.getTestRunResponse().getA11y().getNewCount(), is(2));
    }

    @Test
    public void ignoresAccessibilityIssuesByDefault() throws Exception {
        respond(TestRunStatus.OK, new A11ySummary(2, 5, "https://vrt/test/1"));
        TestRunResult result = tracker(false, false).track("Payment", "image");
        assertThat(result.getTestRunResponse().getStatus(), is(TestRunStatus.OK));
    }

    abstract static class AndroidLikeDriver implements WebDriver, TakesScreenshot, HasCapabilities {
        public abstract String currentActivity();
    }

    private static final String LOADING_XML = "<hierarchy><android.widget.ProgressBar class=\"android.widget.ProgressBar\" "
            + "bounds=\"[490,1300][590,1400]\" displayed=\"true\"/></hierarchy>";

    @Test
    public void sendsActivityAndSystemBarsOverride() throws Exception {
        AndroidLikeDriver driver = mock(AndroidLikeDriver.class);
        when(driver.getScreenshotAs(OutputType.BASE64)).thenReturn("c2NyZWVu");
        when(driver.getPageSource()).thenReturn(XML);
        when(driver.getCapabilities()).thenReturn(mock(Capabilities.class));
        when(driver.currentActivity()).thenReturn(".PaymentActivity");
        respond(TestRunStatus.OK, null);

        tracker(false, false).trackDriver(driver, "Payment", TestRunOptions.builder().excludeSystemBars(false).build());

        JsonObject body = sentBody();
        assertThat(body.get("uiActivity").getAsString(), is(".PaymentActivity"));
        assertThat(body.get("excludeSystemBars").getAsBoolean(), is(false));
    }

    @Test
    public void waitsForLoadingIndicatorsToGo() throws Exception {
        WebDriver driver = mock(WebDriver.class, withSettings().extraInterfaces(TakesScreenshot.class));
        when(((TakesScreenshot) driver).getScreenshotAs(OutputType.BASE64)).thenReturn("c2NyZWVu");
        when(driver.getPageSource()).thenReturn(LOADING_XML, LOADING_XML, XML);
        respond(TestRunStatus.OK, null);

        tracker(false, false).trackDriver(driver, "Payment");

        assertThat(gunzipBase64(sentBody().get("uiTree").getAsString()), is(XML));
    }

    @Test
    public void detectsVisibleLoadingIndicatorsOnly() {
        assertThat(DriverCapture.showsLoading(LOADING_XML), is(true));
        assertThat(DriverCapture.showsLoading(LOADING_XML.replace("displayed=\"true\"", "displayed=\"false\"")), is(false));
        assertThat(DriverCapture.showsLoading(XML), is(false));
        assertThat(DriverCapture.showsLoading(null), is(false));
    }

    @Test
    public void builderReadsTheFlag() {
        VisualRegressionTrackerConfig config = VisualRegressionTrackerConfig.builder()
                .apiUrl("u").apiKey("k").project("p")
                .failOnNewA11yIssues(true)
                .build();
        assertThat(config.getFailOnNewA11yIssues(), is(true));
        assertThat(config.getStableScreenTimeoutMillis(), is(5000));
        assertThat(UiTreeEncoder.encode(null), nullValue());
    }
}
