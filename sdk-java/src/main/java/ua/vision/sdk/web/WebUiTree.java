package ua.vision.sdk.web;

import lombok.extern.slf4j.Slf4j;
import org.openqa.selenium.JavascriptExecutor;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.Map;

/**
 * Collects the UI tree of the current web page for {@code VisionOptions.uiTree} (spec 050).
 * <p>
 * The tree is the page's HTML as the browser holds it, marked up with where each element is
 * shown, what is hidden and what a screen reader announces. It is collected by the same script
 * as in the other Vision SDKs, so a page gives the same tree from Selenide and Playwright.
 * Call it in the same session right before taking the screenshot:
 *
 * <pre>{@code
 * JavascriptExecutor driver = (JavascriptExecutor) WebDriverRunner.getWebDriver();
 * String uiTree = WebUiTree.collect(driver);
 * String screenshot = Selenide.screenshot(OutputType.BASE64);
 * vision.track("Checkout", screenshot, VisionOptions.builder()
 *         .browser("chrome")
 *         .browserVersion("131")
 *         .uiTree(uiTree)
 *         .build());
 * }</pre>
 *
 * Selenium is not a dependency of the SDK: the test's own Selenide or WebDriver provides it.
 */
@Slf4j
public final class WebUiTree {

    static final String SCRIPT_RESOURCE = "/ua/vision/sdk/web/collect-tree.js";

    private WebUiTree() {
    }

    /**
     * The tree of the part of the page in the viewport, as a viewport screenshot shows it.
     *
     * @return the tree, or {@code null} when it could not be collected (a warning is logged)
     */
    public static String collect(JavascriptExecutor driver) {
        return collect(driver, false);
    }

    /**
     * @param fullPage {@code true} for a full-page screenshot: the tree covers the whole page
     * @return the tree, or {@code null} when it could not be collected (a warning is logged)
     */
    public static String collect(JavascriptExecutor driver, boolean fullPage) {
        // a tree is extra: the screenshot must still go to Vision when the page refuses the script
        try {
            Object tree = driver.executeScript("return (" + Script.TEXT + ")(arguments[0]);",
                    Map.of("capture", fullPage ? "page" : "viewport"));
            if (tree instanceof String) {
                return (String) tree;
            }
            log.warn("Could not collect the web UI tree: the page returned {} instead of HTML", tree);
        } catch (Exception | LinkageError e) {
            log.warn("Could not collect the web UI tree, sending the screenshot without it: {}", e.toString());
        }
        return null;
    }

    // read once, on the first collect: the script is the same for every page
    private static final class Script {
        static final String TEXT = load();

        private static String load() {
            try (InputStream in = WebUiTree.class.getResourceAsStream(SCRIPT_RESOURCE)) {
                if (in == null) {
                    throw new IllegalStateException(SCRIPT_RESOURCE + " is missing from the SDK jar");
                }
                return new String(in.readAllBytes(), StandardCharsets.UTF_8);
            } catch (IOException e) {
                throw new UncheckedIOException(e);
            }
        }
    }
}
