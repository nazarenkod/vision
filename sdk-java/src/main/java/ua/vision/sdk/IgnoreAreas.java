package ua.vision.sdk;

import lombok.Builder;
import lombok.Data;

@Builder
@Data
public class IgnoreAreas {

    private final Long x;
    private final Long y;
    private final Long width;
    private final Long height;
}
