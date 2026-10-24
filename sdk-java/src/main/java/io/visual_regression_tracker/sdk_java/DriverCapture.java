package io.visual_regression_tracker.sdk_java;

import lombok.Getter;
import org.openqa.selenium.Capabilities;
import org.openqa.selenium.HasCapabilities;
import org.openqa.selenium.OutputType;
import org.openqa.selenium.TakesScreenshot;
import org.openqa.selenium.WebDriver;

import java.lang.reflect.Method;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Screenshot, page source and device facts read from a Selenium/Appium driver.
 * Kept in its own class so the rest of the SDK works without Selenium on the classpath.
 */
@Getter
final class DriverCapture {
    private final String imageBase64;
    private final String pageSource;
    private final String uiTreeFormat;
    private final Integer deviceDensity;
    private final String activity;
    // a loading indicator was still visible when the wait ran out
    private final boolean stillLoading;

    private static final long POLL_MILLIS = 500;
    // the same element kinds the server treats as "taken too early"
    private static final Pattern LOADING_ELEMENT = Pattern.compile(
            "<[^>]*(ProgressBar|ProgressIndicator|CircularProgress|LinearProgress|Shimmer|Skeleton"
                    + "|XCUIElementTypeActivityIndicator|android\\.widget\\.Toast)[^>]*>");

    private DriverCapture(String imageBase64, String pageSource, String uiTreeFormat, Integer deviceDensity,
                          String activity, boolean stillLoading) {
        this.imageBase64 = imageBase64;
        this.pageSource = pageSource;
        this.uiTreeFormat = uiTreeFormat;
        this.deviceDensity = deviceDensity;
        this.activity = activity;
        this.stillLoading = stillLoading;
    }

    /** Whether the page source shows a visible spinner, skeleton or toast. */
    static boolean showsLoading(String pageSource) {
        if (pageSource == null) {
            return false;
        }
        Matcher matcher = LOADING_ELEMENT.matcher(pageSource);
        while (matcher.find()) {
            String tag = matcher.group();
            boolean hidden = tag.contains("displayed=\"false\"") || tag.contains("visible=\"false\"")
                    || tag.contains("bounds=\"[0,0][0,0]\"");
            if (!hidden) {
                return true;
            }
        }
        return false;
    }

    static DriverCapture of(WebDriver driver) {
        return of(driver, 0);
    }

    static DriverCapture of(WebDriver driver, Integer stableScreenTimeoutMillis) {
        if (!(driver instanceof TakesScreenshot)) {
            throw new IllegalArgumentException("The driver cannot take screenshots");
        }
        // wait for loading indicators to go, so the screenshot shows the settled screen
        long deadline = System.currentTimeMillis() + (stableScreenTimeoutMillis == null ? 0 : stableScreenTimeoutMillis);
        String source = driver.getPageSource();
        while (showsLoading(source) && System.currentTimeMillis() < deadline) {
            try {
                Thread.sleep(POLL_MILLIS);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            }
            source = driver.getPageSource();
        }
        String image = ((TakesScreenshot) driver).getScreenshotAs(OutputType.BASE64);
        String format = null;
        Integer density = null;
        if (driver instanceof HasCapabilities) {
            Capabilities capabilities = ((HasCapabilities) driver).getCapabilities();
            Object platform = capability(capabilities, "platformName");
            if (platform != null) {
                String name = platform.toString().toLowerCase();
                format = name.contains("android") ? "appium-android" : name.contains("ios") ? "appium-ios" : null;
            }
            Object dpi = capability(capabilities, "deviceScreenDensity");
            if (dpi != null) {
                try {
                    density = (int) Double.parseDouble(dpi.toString());
                } catch (NumberFormatException ignored) {
                    // unknown density: the server estimates it
                }
            }
        }
        return new DriverCapture(image, source, format, density, currentActivity(driver), showsLoading(source));
    }

    /** AndroidDriver.currentActivity(), without depending on the Appium client. */
    private static String currentActivity(WebDriver driver) {
        try {
            Method method = driver.getClass().getMethod("currentActivity");
            Object value = method.invoke(driver);
            return value == null ? null : value.toString();
        } catch (ReflectiveOperationException | RuntimeException e) {
            return null;
        }
    }

    private static Object capability(Capabilities capabilities, String name) {
        Object value = capabilities.getCapability(name);
        return value != null ? value : capabilities.getCapability("appium:" + name);
    }
}
