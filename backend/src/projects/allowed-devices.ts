/** A device the team runs its tests on: as the test sends it in `device` and `os` (028). */
export interface AllowedDevice {
  device: string;
  // exact version, or a prefix and `.*` for any version under it: BrowserStack picks 26.1 or 26.2 itself
  os: string;
}

const WILDCARD = '.*';

const norm = (value: string) => value.trim().toLowerCase();

/**
 * The project's list from its saved settings. Entries it cannot read are left
 * out, so a broken setting never stops snapshots from coming in.
 */
export function parseAllowedDevices(raw: unknown): AllowedDevice[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const devices: AllowedDevice[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const { device, os } = entry as Record<string, unknown>;
    if (typeof device !== 'string' || typeof os !== 'string' || !device.trim() || !os.trim()) continue;
    const key = JSON.stringify([norm(device), norm(os)]);
    if (seen.has(key)) continue;
    seen.add(key);
    devices.push({ device: device.trim(), os: os.trim() });
  }
  return devices;
}

/** Why the entry cannot be saved, or null: `*` is only allowed as a trailing `.*` of the OS. */
export function invalidAllowedDevice(entry: { device?: unknown; os?: unknown }): string | null {
  const device = typeof entry.device === 'string' ? entry.device.trim() : '';
  const os = typeof entry.os === 'string' ? entry.os.trim() : '';
  if (!device || !os) return 'An allowed device needs both a device and an OS.';
  const prefix = os.endsWith(WILDCARD) ? os.slice(0, -WILDCARD.length) : os;
  if (device.includes('*') || prefix.includes('*') || !prefix.trim()) {
    return `"${device}" / "${os}": * is only supported at the end of the OS version, as in "26.*".`;
  }
  return null;
}

function osMatches(entry: string, os: string): boolean {
  const wanted = norm(entry);
  const sent = norm(os);
  if (!wanted.endsWith(WILDCARD)) return sent === wanted;
  const prefix = wanted.slice(0, -WILDCARD.length);
  return sent === prefix || sent.startsWith(`${prefix}.`);
}

export function deviceAllowed(allowed: AllowedDevice[], device: string, os: string): boolean {
  return allowed.some((entry) => norm(entry.device) === norm(device) && osMatches(entry.os, os));
}

/**
 * The error for a snapshot from a device the project does not allow, or null
 * when it may come in. The test's author reads it in the test log, so it says
 * what was sent and what would pass.
 */
export function deviceRejection(
  allowed: AllowedDevice[],
  snapshot: { name: string; customTags?: string | null; device?: string | null; os?: string | null },
  projectName: string
): string | null {
  if (!allowed.length) return null;
  const device = snapshot.device?.trim() ?? '';
  const os = snapshot.os?.trim() ?? '';
  if (device && os && deviceAllowed(allowed, device, os)) return null;
  const check = snapshot.customTags ? `${snapshot.name} [${snapshot.customTags}]` : snapshot.name;
  const missing = !device && !os ? 'a device and OS' : !device ? 'a device' : !os ? 'an OS' : '';
  const sent = missing ? `without ${missing}` : `from device "${device}", OS "${os}"`;
  const list = allowed.map((entry) => `"${entry.device}" / "${entry.os}"`).join(', ');
  return (
    `Device not allowed in project "${projectName}": check "${check}" was sent ${sent}. ` +
    `Allowed: ${list}. Run on an allowed device or add it in Project settings → Devices.`
  );
}

/**
 * Manual checks from the Vision CLI and its MCP server are not held to the
 * list (REQ-028-12): they say who they are in the user agent. A guard against
 * mistakes, not access control.
 */
export const fromVisionCli = (userAgent: string | undefined): boolean => /^vision-cli\//i.test(userAgent ?? '');
