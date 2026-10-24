package io.visual_regression_tracker.sdk_java.request;

import java.util.List;

import io.visual_regression_tracker.sdk_java.IgnoreAreas;
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
    // base64 of the gzip-compressed page source; left out of the JSON when null
    private final String uiTree;
    private final String uiTreeFormat;
    private final Integer deviceDensity;
    private final String uiActivity;
    private final Boolean excludeSystemBars;
}
