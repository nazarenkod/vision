package ua.vision.sdk.request;

import java.util.List;

import ua.vision.sdk.IgnoreAreas;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class TestRunRequest {
    private final String projectId;
    private final String buildId;
    private final String name;
    private final String imageBase64;
    private final String os;
    private final String browser;
    private final String viewport;
    private final String device;
    private final String customTags;
    private final Float diffTollerancePercent;
    private final String branchName;
    private final List<IgnoreAreas> ignoreAreas;
    // gzipped and base64-encoded page source
    private final String uiTree;
    // "web" for a web page's tree; left out for Appium page sources, as before 050
    private final String uiTreeFormat;
    private final String featureName;
    private final String browserVersion;
}
