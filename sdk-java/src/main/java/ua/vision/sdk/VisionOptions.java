package ua.vision.sdk;

import java.util.List;

import lombok.Builder;
import lombok.Getter;
import lombok.ToString;

@Builder
@Getter
@ToString
public class VisionOptions {
    private final String os;
    private final String browser;
    private final String viewport;
    private final String device;
    private final String customTags;
    private final Float diffTollerancePercent;
    private final List<IgnoreAreas> ignoreAreas;
    /**
     * Optional: the screen's UI tree, e.g. Appium's {@code driver.getPageSource()}, or for a web
     * page {@link ua.vision.sdk.web.WebUiTree#collect}. Enables accessibility checks and
     * element-level comparison on the server.
     */
    private final String uiTree;
    /**
     * Optional: the feature the screen belongs to, e.g. "Checkout". Names bugs filed
     * from the review; the server takes the part of the name before the first dot
     * when it is not given. Not part of the check's identity: baselines stay the same.
     */
    private final String featureName;
    /**
     * Optional: the browser's version, e.g. "131.0.6778.85". Shown in the review and in bugs;
     * not part of the check's identity, so a browser update keeps the baselines.
     */
    private final String browserVersion;
}
