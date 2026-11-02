import { english, Text } from "../i18n";

export interface DeviceParts {
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

export type DeviceField = "os" | "device" | "browser" | "viewport";

export interface DeviceTag {
  field: DeviceField;
  value: string;
}

// the order the test run table shows its tags in, which every screen follows (REQ-036-01)
const DEVICE_FIELDS: DeviceField[] = ["os", "device", "browser", "viewport"];

/** The profile's non-empty values, one tag each, in the table's order. */
export const deviceTagsOf = (parts: DeviceParts): DeviceTag[] =>
  DEVICE_FIELDS.map((field) => ({
    field,
    value: (parts[field] ?? "").trim(),
  })).filter((tag) => tag.value);
