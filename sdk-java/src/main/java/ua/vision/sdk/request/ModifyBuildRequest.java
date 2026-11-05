package ua.vision.sdk.request;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class ModifyBuildRequest {
    private final Boolean isRunning;
    private final String ciBuildId;
}
