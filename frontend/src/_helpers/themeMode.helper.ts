import type { ThemeMode } from "../theme";

/** "system" means nobody chose: follow the operating system. */
export type ThemePreference = "system" | ThemeMode;

export const THEME_STORAGE_KEY = "vision.theme";

export const resolveMode = (
  preference: ThemePreference,
  systemDark: boolean,
): ThemeMode =>
  preference === "system" ? (systemDark ? "dark" : "light") : preference;

/** The header button and Shift+D always flip what is on screen now. */
export const flippedPreference = (shown: ThemeMode): ThemePreference =>
  shown === "dark" ? "light" : "dark";

// Storage can be missing or throw (private windows, blocked site data): the
// theme then simply follows the system.
export function readPreference(
  storage: Pick<Storage, "getItem"> | undefined,
): ThemePreference {
  try {
    const value = storage?.getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

export function writePreference(
  storage: Pick<Storage, "setItem" | "removeItem"> | undefined,
  preference: ThemePreference,
): void {
  try {
    if (preference === "system") storage?.removeItem(THEME_STORAGE_KEY);
    else storage?.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // remembered for this page only
  }
}

/** Shift+D toggles the theme, except while someone is typing. */
export const isThemeHotkey = (event: {
  key: string;
  shiftKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  target: EventTarget | null;
}): boolean =>
  event.shiftKey &&
  !event.metaKey &&
  !event.ctrlKey &&
  !event.altKey &&
  event.key.toLowerCase() === "d" &&
  !isTyping(event.target);

export function isTyping(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element || typeof element.tagName !== "string") return false;
  return (
    element.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName)
  );
}

type Viewport = { width: number; height: number };

/**
 * The theme circle growing from (x, y). Its edge is soft: a hard edge that
 * touches a side of the screen runs along it at once, and a whole strip
 * floods in a frame. Spread over `feather` pixels, each spot of the screen
 * turns gradually instead. The circle starts a little open, so the click
 * shows at once, and ends with the soft edge past the farthest corner, so
 * nothing is left half turned.
 */
export function revealCircle(
  x: number,
  y: number,
  { width, height }: Viewport,
): { feather: number; from: number; radius: number } {
  const farthest = Math.hypot(Math.max(x, width - x), Math.max(y, height - y));
  const feather = Math.round(Math.min(220, Math.max(100, farthest * 0.12)));
  return {
    feather,
    from: Math.round(feather * 0.6),
    radius: Math.ceil(farthest + feather),
  };
}
