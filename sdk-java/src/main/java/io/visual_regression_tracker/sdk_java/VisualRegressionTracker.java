package io.visual_regression_tracker.sdk_java;

import com.google.gson.Gson;
import io.visual_regression_tracker.sdk_java.request.BuildRequest;
import io.visual_regression_tracker.sdk_java.request.ModifyBuildRequest;
import io.visual_regression_tracker.sdk_java.request.TestRunRequest;
import io.visual_regression_tracker.sdk_java.response.BuildResponse;
import io.visual_regression_tracker.sdk_java.response.TestRunResponse;
import lombok.extern.slf4j.Slf4j;

import java.io.File;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

enum METHOD {
    GET,
    POST,
    PATCH
}

@Slf4j
public class VisualRegressionTracker {

    private static final String TRACKER_NOT_STARTED = "Visual Regression Tracker has not been started";
    private static final String CONFIG_FILE_NAME = "vrt.json";
    protected static final String API_KEY_HEADER = "apiKey";
    protected static final String PROJECT_HEADER = "project";
    protected Gson gson;
    protected VisualRegressionTrackerConfig configuration;
    protected PathProvider paths;
    protected String buildId;
    protected String projectId;

    public VisualRegressionTracker() {
        VisualRegressionTrackerConfig.VisualRegressionTrackerConfigBuilder configBuilder = VisualRegressionTrackerConfig.builder();
        File configFile = new File(CONFIG_FILE_NAME);
        if (configFile.exists()) {
            configBuilder.configFile(configFile);
        }
        configuration = configBuilder.build();
        paths = new PathProvider(configuration.getApiUrl());
        gson = new Gson();
    }

    public VisualRegressionTracker(VisualRegressionTrackerConfig trackerConfig) {
        configuration = trackerConfig;
        paths = new PathProvider(trackerConfig.getApiUrl());
        gson = new Gson();
    }

    public BuildResponse start() throws IOException, InterruptedException {
        String projectName = configuration.getProject();
        String branch = configuration.getBranchName();
        String ciBuildId = configuration.getCiBuildId();

        BuildRequest newBuild = BuildRequest.builder()
                .branchName(branch)
                .project(projectName)
                .ciBuildId(ciBuildId)
                .build();
        log.info("Starting Visual Regression Tracker for project <{}> and branch <{}>", projectName, branch);
        HttpRequest.BodyPublisher body = HttpRequest.BodyPublishers.ofString(gson.toJson(newBuild));
        HttpResponse<String> response = getResponse(METHOD.POST, paths.getBuildPath(), body);
        BuildResponse buildResponse = handleResponse(response, BuildResponse.class);

        buildId = buildResponse.getId();
        projectId = buildResponse.getProjectId();

        log.info("Visual Regression Tracker is started for project <{}>: projectId: <{}>, buildId: <{}>, ciBuildId: <{}>",
                projectName, projectId, buildId, buildResponse.getCiBuildId());
        return buildResponse;
    }

    public BuildResponse stop() throws IOException, InterruptedException {
        if (!isStarted()) {
            throw new TestRunException(TRACKER_NOT_STARTED);
        }

        log.info("Stopping Visual Regression Tracker for buildId <{}>", buildId);

        ModifyBuildRequest stopBuildRequest = ModifyBuildRequest.builder()
                .isRunning(false)
                .build();
        HttpRequest.BodyPublisher body = HttpRequest.BodyPublishers.ofString(gson.toJson(stopBuildRequest));
        HttpResponse<String> response = getResponse(METHOD.PATCH, paths.getBuildPathForBuild(buildId), body);
        BuildResponse vrtStopResponse = handleResponse(response, BuildResponse.class);

        log.info("Visual Regression Tracker is stopped for buildId <{}>", buildId);
        return vrtStopResponse;
    }

    public TestRunResult track(String name, String imageBase64, TestRunOptions testRunOptions)
            throws IOException, InterruptedException {
        log.info("Tracking test run <{}> with options <{}> for buildId <{}>", name, testRunOptions, buildId);
        TestRunResponse testResultDTO = submitTestRun(name, imageBase64, testRunOptions);

        String errorMessage;
        switch (testResultDTO.getStatus()) {
            case NEW:
                errorMessage = "No baseline: ".concat(testResultDTO.getUrl());
                break;
            case UNRESOLVED:
                errorMessage = "Difference found: ".concat(testResultDTO.getUrl());
                break;
            default:
                errorMessage = "";
                break;
        }
        if (errorMessage.isEmpty() && testResultDTO.getA11y() != null && testResultDTO.getA11y().getNewCount() > 0
                && Boolean.TRUE.equals(configuration.getFailOnNewA11yIssues())) {
            errorMessage = "New accessibility issues (" + testResultDTO.getA11y().getNewCount() + "): "
                    .concat(testResultDTO.getUrl());
        }

        if (!errorMessage.isEmpty()) {
            if (configuration.getEnableSoftAssert()) {
                log.error(errorMessage);
            } else {
                throw new TestRunException(errorMessage);
            }
        }

        return new TestRunResult(testResultDTO, this.paths);
    }

    public TestRunResult track(String name, String imageBase64) throws IOException, InterruptedException {
        return track(name, imageBase64, TestRunOptions.builder().build());
    }

    /**
     * Takes the screenshot and the page source from a Selenium or Appium driver and tracks them,
     * so the server can also check accessibility and describe changes by element.
     * Platform and screen density are read from the driver's capabilities; values set in
     * {@code testRunOptions} take precedence. Works with Selenide: {@code trackDriver(WebDriverRunner.getWebDriver(), name)}.
     */
    public TestRunResult trackDriver(org.openqa.selenium.WebDriver driver, String name, TestRunOptions testRunOptions)
            throws IOException, InterruptedException {
        DriverCapture capture = DriverCapture.of(driver, configuration.getStableScreenTimeoutMillis());
        TestRunOptions options = testRunOptions == null ? TestRunOptions.builder().build() : testRunOptions;
        TestRunOptions withTree = TestRunOptions.builder()
                .os(options.getOs())
                .browser(options.getBrowser())
                .viewport(options.getViewport())
                .device(options.getDevice())
                .customTags(options.getCustomTags())
                .diffTollerancePercent(options.getDiffTollerancePercent())
                .ignoreAreas(options.getIgnoreAreas())
                .uiTree(options.getUiTree() != null ? options.getUiTree() : capture.getPageSource())
                .uiTreeFormat(options.getUiTreeFormat() != null ? options.getUiTreeFormat() : capture.getUiTreeFormat())
                .deviceDensity(options.getDeviceDensity() != null ? options.getDeviceDensity() : capture.getDeviceDensity())
                .uiActivity(options.getUiActivity() != null ? options.getUiActivity() : capture.getActivity())
                .excludeSystemBars(options.getExcludeSystemBars())
                .build();
        if (capture.isStillLoading()) {
            log.warn("Screen <{}> still shows a loading indicator after waiting; tracking it anyway", name);
        }
        return track(name, capture.getImageBase64(), withTree);
    }

    public TestRunResult trackDriver(org.openqa.selenium.WebDriver driver, String name)
            throws IOException, InterruptedException {
        return trackDriver(driver, name, TestRunOptions.builder().build());
    }

    protected boolean isStarted() {
        return buildId != null && projectId != null;
    }

    protected TestRunResponse submitTestRun(String name, String imageBase64,
                                            TestRunOptions testRunOptions) throws IOException, InterruptedException {
        if (!isStarted()) {
            throw new TestRunException(TRACKER_NOT_STARTED);
        }

        TestRunRequest newTestRun = TestRunRequest.builder()
                .projectId(projectId)
                .buildId(buildId)
                .branchName(configuration.getBranchName())
                .name(name)
                .imageBase64(imageBase64)
                .os(testRunOptions.getOs())
                .browser(testRunOptions.getBrowser())
                .viewport(testRunOptions.getViewport())
                .device(testRunOptions.getDevice())
                .customTags(testRunOptions.getCustomTags())
                .diffTollerancePercent(testRunOptions.getDiffTollerancePercent())
                .ignoreAreas(testRunOptions.getIgnoreAreas())
                .uiTree(UiTreeEncoder.encode(testRunOptions.getUiTree()))
                .uiTreeFormat(testRunOptions.getUiTreeFormat())
                .deviceDensity(testRunOptions.getDeviceDensity())
                .uiActivity(testRunOptions.getUiActivity())
                .excludeSystemBars(testRunOptions.getExcludeSystemBars())
                .build();

        HttpRequest.BodyPublisher body = HttpRequest.BodyPublishers.ofString(gson.toJson(newTestRun));
        HttpResponse<String> response = getResponse(METHOD.POST, paths.getTestRunPath(), body);
        return handleResponse(response, TestRunResponse.class);
    }

    private HttpResponse<String> getResponse(METHOD method, String url, HttpRequest.BodyPublisher body) throws IOException, InterruptedException {
        HttpRequest.Builder requestBuilder = HttpRequest.newBuilder()
                .timeout(Duration.ofSeconds(configuration.getHttpTimeoutInSeconds()))
                .header(API_KEY_HEADER, configuration.getApiKey())
                .header(PROJECT_HEADER, configuration.getProject())
                .header("Content-Type", "application/json;charset=UTF-8")
                .uri(URI.create(url));
        HttpRequest request = getRequest(method, body, requestBuilder);
        HttpResponse<String> response = HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1)
                .connectTimeout(Duration.ofSeconds(configuration.getHttpTimeoutInSeconds()))
                .build()
                .send(request, HttpResponse.BodyHandlers.ofString());
        return response;
    }

    protected HttpRequest getRequest(METHOD method, HttpRequest.BodyPublisher body, HttpRequest.Builder requestBuilder) {
        switch (method) {
            case PATCH:
                return requestBuilder.method("PATCH", body).build();
            case POST:
                return requestBuilder.POST(body).build();
            default:
                throw new UnsupportedOperationException("This method is not yet supported.");
        }
    }

    protected <T> T handleResponse(HttpResponse<String> response, Class<T> classOfT) {
        String responseBody = response.body();
        if (!String.valueOf(response.statusCode()).startsWith("2")) {
            throw new TestRunException(responseBody);
        }
        return gson.fromJson(responseBody, classOfT);
    }
}
