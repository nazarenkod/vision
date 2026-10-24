package io.visual_regression_tracker.sdk_java;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.zip.GZIPOutputStream;

/** Page sources are large and repetitive; gzip shrinks them about tenfold before base64. */
final class UiTreeEncoder {
    private UiTreeEncoder() {
    }

    static String encode(String xml) {
        if (xml == null) {
            return null;
        }
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (GZIPOutputStream gzip = new GZIPOutputStream(bytes)) {
            gzip.write(xml.getBytes(StandardCharsets.UTF_8));
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot compress UI tree", e);
        }
        return Base64.getEncoder().encodeToString(bytes.toByteArray());
    }
}
