interface DeviceParts {
  device?: string | null;
  os?: string | null;
  browser?: string | null;
  viewport?: string | null;
}

/**
 * Tests often send the OS as a bare version ("15"), which next to a device name
 * reads as a count; such a version is labelled, "Android 15" or "iOS 17" stays.
 */
export const osLabel = (os: string): string =>
  /^\d+(\.\d+)*$/.test(os.trim()) ? `OS ${os.trim()}` : os;

/** "Pixel 7 · OS 15", from whichever parts are set. */
export const deviceLabel = (parts: DeviceParts, empty = "No device"): string =>
  [
    parts.device,
    parts.os ? osLabel(parts.os) : null,
    parts.browser,
    parts.viewport,
  ]
    .filter(Boolean)
    .join(" · ") || empty;
