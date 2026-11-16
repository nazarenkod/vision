import { deviceRejection } from './allowed-devices';
import type { AllowedDevice } from './allowed-devices';

/** A browser web tests run in, as the test sends it in `browser`, `browserVersion` and `viewport` (050). */
export interface AllowedBrowser {
  browser: string;
  // exact version, or a prefix and `.*`; empty for any version (REQ-050-51)
  version: string;
  // window size as `1280x720`; empty for any size
  viewport: string;
}

const WILDCARD = '.*';

const norm = (value: string) => value.trim().toLowerCase();
// `1280×720`, `1280 x 720` and `1280x720` are one size
const normSize = (value: string) => norm(value).replace(/\s+/g, '').replace(/×/g, 'x');
const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

/** The project's list from its saved settings; entries it cannot read are left out, as for devices. */
export function parseAllowedBrowsers(raw: unknown): AllowedBrowser[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const browsers: AllowedBrowser[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const record = entry as Record<string, unknown>;
    const browser = text(record.browser);
    if (!browser) continue;
    const item = { browser, version: text(record.version), viewport: normSize(text(record.viewport)) };
    const key = JSON.stringify([norm(item.browser), norm(item.version), item.viewport]);
    if (seen.has(key)) continue;
    seen.add(key);
    browsers.push(item);
  }
  return browsers;
}

/** Why the entry cannot be saved, or null: a browser is needed, `*` only as a trailing `.*` of the version. */
export function invalidAllowedBrowser(entry: {
  browser?: unknown;
  version?: unknown;
  viewport?: unknown;
}): string | null {
  const browser = text(entry.browser);
  const version = text(entry.version);
  const viewport = text(entry.viewport);
  if (!browser) return 'An allowed browser needs a browser name.';
  const prefix = version.endsWith(WILDCARD) ? version.slice(0, -WILDCARD.length) : version;
  if (browser.includes('*') || prefix.includes('*') || viewport.includes('*') || (version && !prefix.trim())) {
    return `"${browser}" / "${version}": * is only supported at the end of the version, as in "131.*".`;
  }
  if (viewport && !/^\d+x\d+$/.test(normSize(viewport))) {
    return `"${browser}": the window size "${viewport}" should look like 1280x720.`;
  }
  return null;
}

function versionMatches(entry: string, version: string): boolean {
  const wanted = norm(entry);
  if (!wanted) return true;
  const sent = norm(version);
  if (!wanted.endsWith(WILDCARD)) return sent === wanted;
  const prefix = wanted.slice(0, -WILDCARD.length);
  return sent === prefix || sent.startsWith(`${prefix}.`);
}

export function browserAllowed(allowed: AllowedBrowser[], browser: string, version: string, viewport: string): boolean {
  return allowed.some(
    (entry) =>
      norm(entry.browser) === norm(browser) &&
      versionMatches(entry.version, version) &&
      (!entry.viewport || normSize(entry.viewport) === normSize(viewport))
  );
}

export interface SnapshotOrigin {
  name: string;
  customTags?: string | null;
  device?: string | null;
  os?: string | null;
  browser?: string | null;
  browserVersion?: string | null;
  viewport?: string | null;
}

/**
 * The error for a snapshot the project does not allow, or null: one that names a browser is
 * held to the browsers, any other to the devices (REQ-050-52), so a project of both platforms
 * checks Appium and Selenide snapshots each against its own list.
 */
export function snapshotRejection(
  lists: { allowedDevices: AllowedDevice[]; allowedBrowsers: AllowedBrowser[] },
  snapshot: SnapshotOrigin,
  projectName: string
): string | null {
  const browser = snapshot.browser?.trim() ?? '';
  if (!browser) return deviceRejection(lists.allowedDevices, snapshot, projectName);
  const allowed = lists.allowedBrowsers;
  if (!allowed.length) return null;
  const version = snapshot.browserVersion?.trim() ?? '';
  const viewport = snapshot.viewport?.trim() ?? '';
  if (browserAllowed(allowed, browser, version, viewport)) return null;
  const check = snapshot.customTags ? `${snapshot.name} [${snapshot.customTags}]` : snapshot.name;
  const sent = [`browser "${browser}"`, `version "${version || '?'}"`, `window "${viewport || '?'}"`].join(', ');
  const list = allowed
    .map((entry) => `"${entry.browser}" / "${entry.version || 'any'}" / "${entry.viewport || 'any'}"`)
    .join(', ');
  return (
    `Browser not allowed in project "${projectName}": check "${check}" was sent from ${sent}. ` +
    `Allowed: ${list}. Run in an allowed browser or add it in Project settings > Devices.`
  );
}
