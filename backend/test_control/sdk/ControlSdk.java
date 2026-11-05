import com.google.gson.Gson;
import io.visual_regression_tracker.sdk_java.Vision;
import io.visual_regression_tracker.sdk_java.VisionConfig;
import io.visual_regression_tracker.sdk_java.VisionOptions;
import io.visual_regression_tracker.sdk_java.VisionResult;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Drives the SDK the way an autotest does: one build, a check per line of the plan
 * ("name|png|xml|device|os"), then stop. Prints what the SDK returned as JSON, so the
 * control scenario compares the SDK's own view of each check.
 *
 *   java -cp <sdk classpath> ControlSdk.java <api> <apiKey> <project> <branch> <plan>
 */
public class ControlSdk {
    public static void main(String[] args) throws Exception {
        VisionConfig config = VisionConfig.builder()
                .apiUrl(args[0])
                .apiKey(args[1])
                .project(args[2])
                .branchName(args[3])
                .enableSoftAssert(true)
                .httpTimeoutInSeconds(60)
                .build();
        Vision vision = new Vision(config);
        List<Map<String, Object>> results = new ArrayList<>();
        vision.start();
        for (String line : Files.readAllLines(Paths.get(args[4]), StandardCharsets.UTF_8)) {
            if (line.isBlank()) continue;
            String[] part = line.split("\\|", -1);
            String image = Base64.getEncoder().encodeToString(Files.readAllBytes(Paths.get(part[1])));
            VisionOptions.VisionOptionsBuilder options = VisionOptions.builder().device(part[3]).os(part[4]);
            if (!part[2].isEmpty()) {
                options.uiTree(new String(Files.readAllBytes(Paths.get(part[2])), StandardCharsets.UTF_8));
            }
            VisionResult result = vision.track(part[0], image, options.build());
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("name", part[0]);
            row.put("status", String.valueOf(result.getTestRunResponse().getStatus()));
            row.put("diffPercent", result.getTestRunResponse().getDiffPercent());
            row.put("pixelMisMatchCount", result.getTestRunResponse().getPixelMisMatchCount());
            row.put("url", result.getTestRunResponse().getUrl());
            row.put("imageUrl", result.getImageUrl());
            row.put("baselineUrl", result.getBaselineUrl());
            row.put("diffUrl", result.getDiffUrl());
            results.add(row);
        }
        vision.stop();
        System.out.println("CONTROL_RESULT=" + new Gson().toJson(results));
    }
}
