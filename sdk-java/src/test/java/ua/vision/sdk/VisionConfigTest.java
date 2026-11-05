package ua.vision.sdk;

import org.testng.annotations.Test;
import uk.org.webcompere.systemstubs.environment.EnvironmentVariables;

import java.io.File;

import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.MatcherAssert.assertThat;

public class VisionConfigTest {

    @Test(expectedExceptions = NullPointerException.class,
            expectedExceptionsMessageRegExp = "apiKey is marked non-null but is null")
    public void shouldThrowExceptionIfApiKeyMissed() {
        VisionConfig
                .builder()
                .apiUrl("")
                .project("")
                .build();
    }

    @Test(expectedExceptions = NullPointerException.class,
            expectedExceptionsMessageRegExp = "apiUrl is marked non-null but is null")
    public void shouldThrowExceptionIfApiUrlMissed() {
        VisionConfig
                .builder()
                .apiKey("")
                .project("")
                .build();
    }

    @Test(expectedExceptions = NullPointerException.class,
            expectedExceptionsMessageRegExp = "project is marked non-null but is null")
    public void shouldThrowExceptionIfProjectMissed() {
        VisionConfig
                .builder()
                .apiKey("")
                .apiUrl("")
                .build();
    }

    @Test
    public void shouldBeCreatedFromConfigFile() {
        File configFile = new File("src/test/resources/vision_config_example.json");

        VisionConfig config = VisionConfig.builder()
                .configFile(configFile)
                .build();

        assertThat(config.getApiKey(), is("SECRET"));
        assertThat(config.getApiUrl(), is("http://162.243.161.172:4200"));
        assertThat(config.getProject(), is("Vision"));
        assertThat(config.getBranchName(), is("master"));
        assertThat(config.getEnableSoftAssert(), is(false));
        assertThat(config.getCiBuildId(), is("SOME_UNIQUE_ID"));
    }

    @Test
    public void shouldBeCreatedFromEnvironment() throws Exception {
        EnvironmentVariables environmentVariables = new EnvironmentVariables("VISION_APIKEY", "SECRET")
                .set("VISION_APIURL", "http://162.243.161.172:4200")
                .set("VISION_PROJECT", "Vision")
                .set("VISION_BRANCHNAME", "master")
                .set("VISION_ENABLESOFTASSERT", "false")
                .set("VISION_CIBUILDID", "SOME_UNIQUE_ID");

        VisionConfig config = environmentVariables.execute(() ->
                VisionConfig.builder()
                        .build()
        );

        assertThat(config.getApiKey(), is("SECRET"));
        assertThat(config.getApiUrl(), is("http://162.243.161.172:4200"));
        assertThat(config.getProject(), is("Vision"));
        assertThat(config.getBranchName(), is("master"));
        assertThat(config.getEnableSoftAssert(), is(false));
        assertThat(config.getCiBuildId(), is("SOME_UNIQUE_ID"));
    }

    // a test left on the old VRT_* names fails at start, saying which setting is missing
    @Test(expectedExceptions = NullPointerException.class,
            expectedExceptionsMessageRegExp = "apiUrl is marked non-null but is null")
    public void ignoresVrtVariables() throws Exception {
        EnvironmentVariables environmentVariables = new EnvironmentVariables("VRT_APIKEY", "SECRET")
                .set("VRT_APIURL", "http://162.243.161.172:4200")
                .set("VRT_PROJECT", "Vision");

        environmentVariables.execute(() -> VisionConfig.builder().build());
    }

    @Test
    public void shouldResolveFinalValuesInTheRightOrder() throws Exception {
        EnvironmentVariables environmentVariables = new EnvironmentVariables("VISION_APIKEY", "ENV_SECRET")
                .set("VISION_APIURL", "http://162.243.161.172:4201");
        File configFile = new File("src/test/resources/vision_config_example.json");

        VisionConfig config = environmentVariables.execute(() ->
                VisionConfig.builder()
                        .apiUrl("http://localhost:4200")
                        .configFile(configFile)
                        .build()
        );

        assertThat(config.getApiKey(), is("ENV_SECRET"));
        assertThat(config.getApiUrl(), is("http://localhost:4200"));
        assertThat(config.getProject(), is("Vision"));
        assertThat(config.getBranchName(), is("master"));
        assertThat(config.getEnableSoftAssert(), is(false));
        assertThat(config.getCiBuildId(), is("SOME_UNIQUE_ID"));
    }


    @Test
    public void shouldUseDefaultValuesIfNotProvided() {
        VisionConfig config = VisionConfig.builder()
                        .apiUrl("http://localhost:4200")
                        .apiKey("KEY")
                        .project("PROJECT")
                        .build();

        assertThat(config.getEnableSoftAssert(), is(false));
        assertThat(config.getHttpTimeoutInSeconds(), is(10));
    }
}
