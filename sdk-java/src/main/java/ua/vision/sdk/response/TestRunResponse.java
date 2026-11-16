package ua.vision.sdk.response;

import ua.vision.sdk.TestRunStatus;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class TestRunResponse {
    private final String id;
    private final String imageName;
    private final String diffName;
    private final String baselineName;
    private final Float diffPercent;
    private final Float diffTollerancePercent;
    private final Integer pixelMisMatchCount;
    private final Boolean merge;
    private final String url;
    private final TestRunStatus status;
}
