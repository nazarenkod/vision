package io.visual_regression_tracker.sdk_java;

import lombok.Getter;
import org.openqa.selenium.Capabilities;
import org.openqa.selenium.HasCapabilities;
import org.openqa.selenium.OutputType;
import org.openqa.selenium.TakesScreenshot;
import org.openqa.selenium.WebDriver;

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

    private DriverCapture(String imageBase64, String pageSource, String uiTreeFormat, Integer deviceDensity) {
        this.imageBase64 = imageBase64;
        this.pageSource = pageSource;
        this.uiTreeFormat = uiTreeFormat;
        this.deviceDensity = deviceDensity;
    }

    static DriverCapture of(WebDriver driver) {
        if (!(driver instanceof TakesScreenshot)) {
            throw new IllegalArgumentException("The driver cannot take screenshots");
        }
        String image = ((TakesScreenshot) driver).getScreenshotAs(OutputType.BASE64);
        String source = driver.getPageSource();
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
        return new DriverCapture(image, source, format, density);
    }

    private static Object capability(Capabilities capabilities, String name) {
        Object value = capabilities.getCapability(name);
        return value != null ? value : capabilities.getCapability("appium:" + name);
    }
}
