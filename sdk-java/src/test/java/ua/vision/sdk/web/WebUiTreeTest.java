package ua.vision.sdk.web;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import org.mockito.ArgumentCaptor;
import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.NoSuchSessionException;
import org.openqa.selenium.WebDriverException;
import org.slf4j.LoggerFactory;
import org.testng.annotations.Test;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.Map;

import static org.hamcrest.CoreMatchers.containsString;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.CoreMatchers.nullValue;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

public class WebUiTreeTest {

    private static final String HTML = "<!DOCTYPE html><html data-vision-capture=\"viewport\"><body></body></html>";

    // the collector shared by every SDK, as it is in the repository
    private static String sharedScript() throws IOException {
        return new String(Files.readAllBytes(Paths.get("../web-tree/collect-tree.js")), StandardCharsets.UTF_8);
    }

    @Test
    public void collectsTheTreeWithTheSharedScript() throws IOException {
        JavascriptExecutor driver = mock(JavascriptExecutor.class);
        when(driver.executeScript(anyString(), any())).thenReturn(HTML);

        String tree = WebUiTree.collect(driver);

        ArgumentCaptor<String> script = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<Object> options = ArgumentCaptor.forClass(Object.class);
        verify(driver).executeScript(script.capture(), options.capture());
        assertThat(tree, is(HTML));
        assertThat(script.getValue(), is("return (" + sharedScript() + ")(arguments[0]);"));
        assertThat(options.getValue(), is(Map.of("capture", "viewport")));
    }

    @Test
    public void collectsTheWholePageForAFullPageScreenshot() {
        JavascriptExecutor driver = mock(JavascriptExecutor.class);
        when(driver.executeScript(anyString(), any())).thenReturn(HTML);

        WebUiTree.collect(driver, true);

        verify(driver).executeScript(anyString(), eq(Map.of("capture", "page")));
    }

    @Test
    public void givesNoTreeAndWarnsWhenThePageIsClosed() {
        ListAppender<ILoggingEvent> log = webUiTreeLog();
        JavascriptExecutor driver = mock(JavascriptExecutor.class);
        when(driver.executeScript(anyString(), any())).thenThrow(new NoSuchSessionException("session closed"));

        String tree = WebUiTree.collect(driver);

        assertThat(tree, is(nullValue()));
        ILoggingEvent warning = log.list.stream().filter(e -> e.getLevel() == Level.WARN).findFirst().orElseThrow();
        assertThat(warning.getFormattedMessage(), containsString("session closed"));
    }

    @Test
    public void givesNoTreeWhenThePageForbidsTheScript() {
        JavascriptExecutor driver = mock(JavascriptExecutor.class);
        when(driver.executeScript(anyString(), any())).thenThrow(new WebDriverException("javascript error: CSP"));

        assertThat(WebUiTree.collect(driver, true), is(nullValue()));
    }

    @Test
    public void givesNoTreeWhenTheScriptReturnsNoHtml() {
        JavascriptExecutor driver = mock(JavascriptExecutor.class);
        when(driver.executeScript(anyString(), any())).thenReturn(null);

        assertThat(WebUiTree.collect(driver), is(nullValue()));
    }

    private ListAppender<ILoggingEvent> webUiTreeLog() {
        ListAppender<ILoggingEvent> appender = new ListAppender<>();
        appender.start();
        ((Logger) LoggerFactory.getLogger(WebUiTree.class)).addAppender(appender);
        return appender;
    }
}
