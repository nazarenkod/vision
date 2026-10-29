import { english, Text } from "../i18n";

interface DeviceParts {
  device?: string | null;
  os?: string | null;
  browser?: string | null;
  viewport?: string | null;
}

/**
 * "OS: 15 · Device: PIXEL_4_XL": each value named and in the order upstream VRT
 * shows them, since a bare value ("15") says nothing about what it is.
 */
export const deviceLabel = (
  parts: DeviceParts,
  empty?: string,
  text: Text = english,
): string =>
  [
    parts.os && text("device.os", { value: parts.os }),
    parts.device && text("device.device", { value: parts.device }),
    parts.browser && text("device.browser", { value: parts.browser }),
    parts.viewport && text("device.viewport", { value: parts.viewport }),
  ]
    .filter(Boolean)
    .join(" · ") ||
  (empty ?? text("device.none"));
