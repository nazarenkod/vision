import { AllowedDevice } from "../types";

// the backend's rules (backend/src/projects/allowed-devices.ts), so a wrong
// entry shows before saving; the server still refuses it on save
const WILDCARD = ".*";

const norm = (value: string) => value.trim().toLowerCase();

/** The project's list from its UI tree settings JSON; entries it cannot read are left out. */
export function allowedDevicesOf(
  uiTreeSettings: string | null | undefined,
): AllowedDevice[] {
  let raw: unknown;
  try {
    raw = uiTreeSettings ? JSON.parse(uiTreeSettings)?.allowedDevices : [];
  } catch {
    raw = [];
  }
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (entry): entry is AllowedDevice =>
      !!entry &&
      typeof entry.device === "string" &&
      typeof entry.os === "string",
  );
}

export type AllowedDeviceProblem = "missing" | "wildcard";

/** Why the entry cannot be saved, or null: `*` only as a trailing `.*` of the OS. */
export function invalidAllowedDevice(
  entry: AllowedDevice,
): AllowedDeviceProblem | null {
  const device = entry.device.trim();
  const os = entry.os.trim();
  if (!device || !os) return "missing";
  const prefix = os.endsWith(WILDCARD) ? os.slice(0, -WILDCARD.length) : os;
  if (device.includes("*") || prefix.includes("*") || !prefix.trim())
    return "wildcard";
  return null;
}

function osMatches(entry: string, os: string): boolean {
  const wanted = norm(entry);
  const sent = norm(os);
  if (!wanted.endsWith(WILDCARD)) return sent === wanted;
  const prefix = wanted.slice(0, -WILDCARD.length);
  return sent === prefix || sent.startsWith(`${prefix}.`);
}

export const deviceAllowed = (
  allowed: AllowedDevice[],
  device: string,
  os: string,
): boolean =>
  allowed.some(
    (entry) => norm(entry.device) === norm(device) && osMatches(entry.os, os),
  );

/** The same entry once case and surrounding spaces are set aside. */
export const sameDevice = (a: AllowedDevice, b: AllowedDevice): boolean =>
  norm(a.device) === norm(b.device) && norm(a.os) === norm(b.os);
