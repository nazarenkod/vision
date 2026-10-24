package io.visual_regression_tracker.sdk_java.response;

import lombok.AllArgsConstructor;
import lombok.Getter;

/** Accessibility result of one screenshot, checked on the server from its UI tree. */
@Getter
@AllArgsConstructor
public class A11ySummary {
    /** Issues new against the baseline that nobody has filed or dismissed. */
    private final int newCount;
    /** All issues that count on this screen. */
    private final int totalCount;
    private final String url;
}
