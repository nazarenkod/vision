package io.visual_regression_tracker.sdk_java;

import java.util.List;

import lombok.Builder;
import lombok.Getter;
import lombok.ToString;

@Builder
@Getter
@ToString
public class TestRunOptions {
    private final String os;
    private final String browser;
    private final String viewport;
    private final String device;
    private final String customTags;
    private final Float diffTollerancePercent;
    private final List<IgnoreAreas> ignoreAreas;
    /**
     * Appium page source (XML) of the screen. Sent gzip-compressed so the server can check
     * accessibility and describe changes by element. {@link VisualRegressionTracker#trackDriver} fills it in.
     */
    private final String uiTree;
    /** "appium-android" or "appium-ios"; detected by the server when null. */
    private final String uiTreeFormat;
    /** Android screen density in dpi, for dp-based checks such as touch target size. */
    private final Integer deviceDensity;
    /** Android activity of the screen; helps the server tell screens apart. trackDriver fills it in. */
    private final String uiActivity;
    /** Overrides the project's "leave out status and navigation bars" setting for this screenshot. */
    private final Boolean excludeSystemBars;
}
