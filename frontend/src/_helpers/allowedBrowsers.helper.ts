import { AllowedBrowser } from "../types";

// the backend's rules (backend/src/projects/allowed-browsers.ts), so a wrong
// entry shows before saving; the server still refuses it on save
const WILDCARD = ".*";
const VIEWPORT = /^(\d+)\s*[x×]\s*(\d+)$/i;

const norm = (value: string) => value.trim().toLowerCase();

/** "1280 × 720" as the server keeps it, "1280x720"; anything else as typed, trimmed. */
export function normalizeViewport(value: string): string {
  const match = VIEWPORT.exec(value.trim());
  return match ? `${match[1]}x${match[2]}` : value.trim();
}

/** The project's browsers from its UI tree settings JSON; entries it cannot read are left out. */
export function allowedBrowsersOf(
  uiTreeSettings: string | null | undefined,
): AllowedBrowser[] {
  let raw: unknown;
  try {
    raw = uiTreeSettings ? JSON.parse(uiTreeSettings)?.allowedBrowsers : [];
  } catch {
    raw = [];
  }
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (entry) =>
        !!entry &&
        typeof entry.browser === "string" &&
        ["version", "viewport"].every(
          (field) => entry[field] == null || typeof entry[field] === "string",
        ),
    )
    .map((entry) => ({
      browser: entry.browser,
      version: entry.version ?? "",
      viewport: entry.viewport ?? "",
    }));
}

export type AllowedBrowserProblem = "missing" | "wildcard" | "viewport";

/**
 * Why the entry cannot be saved, or null: a browser is needed, `*` goes only
 * as a trailing `.*` of the version, the window size is width x height.
 */
export function invalidAllowedBrowser(
  entry: AllowedBrowser,
): AllowedBrowserProblem | null {
  const browser = entry.browser.trim();
  const version = entry.version.trim();
  const viewport = entry.viewport.trim();
  if (!browser) return "missing";
  const prefix = version.endsWith(WILDCARD)
    ? version.slice(0, -WILDCARD.length)
    : version;
  if (
    browser.includes("*") ||
    prefix.includes("*") ||
    viewport.includes("*") ||
    (version.endsWith(WILDCARD) && !prefix.trim())
  )
    return "wildcard";
  if (viewport && !VIEWPORT.test(viewport)) return "viewport";
  return null;
}

/** The entry as it is saved: trimmed, the window size with an `x`. */
export const savedBrowser = (entry: AllowedBrowser): AllowedBrowser => ({
  browser: entry.browser.trim(),
  version: entry.version.trim(),
  viewport: normalizeViewport(entry.viewport),
});

function versionMatches(entry: string, version: string): boolean {
  const wanted = norm(entry);
  if (!wanted) return true;
  const sent = norm(version);
  if (!wanted.endsWith(WILDCARD)) return sent === wanted;
  const prefix = wanted.slice(0, -WILDCARD.length);
  return sent === prefix || sent.startsWith(`${prefix}.`);
}

const viewportMatches = (entry: string, viewport: string): boolean =>
  !entry.trim() ||
  norm(normalizeViewport(entry)) === norm(normalizeViewport(viewport));

/** Whether a snapshot from this browser is in the list (REQ-050-51, 52). */
export const browserAllowed = (
  allowed: AllowedBrowser[],
  browser: string,
  version: string,
  viewport: string,
): boolean =>
  allowed.some(
    (entry) =>
      norm(entry.browser) === norm(browser) &&
      versionMatches(entry.version, version) &&
      viewportMatches(entry.viewport, viewport),
  );

/** The same entry once case, spaces and the `×` of the window size are set aside. */
export const sameBrowser = (a: AllowedBrowser, b: AllowedBrowser): boolean =>
  norm(a.browser) === norm(b.browser) &&
  norm(a.version) === norm(b.version) &&
  norm(normalizeViewport(a.viewport)) === norm(normalizeViewport(b.viewport));
