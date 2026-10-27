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
export const deviceLabel = (parts: DeviceParts, empty = "No device"): string =>
  [
    parts.os && `OS: ${parts.os}`,
    parts.device && `Device: ${parts.device}`,
    parts.browser && `Browser: ${parts.browser}`,
    parts.viewport && `Viewport: ${parts.viewport}`,
  ]
    .filter(Boolean)
    .join(" · ") || empty;
