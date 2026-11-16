/**
 * Stored images open only with the signature the server sends beside their names (043): every
 * answer and live event that names an image carries `fileSignatures`, and they are kept here so
 * that an image link built anywhere in the interface is signed. A name the server never signed
 * gets a link that answers 404, like a missing file.
 */
const signatures = new Map<string, string>();

export function rememberFileSignatures(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(rememberFileSignatures);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [field, item] of Object.entries(value)) {
    if (field === "fileSignatures" && item && typeof item === "object") {
      for (const [name, signature] of Object.entries(item)) {
        if (typeof signature === "string") signatures.set(name, signature);
      }
    } else if (item && typeof item === "object") {
      rememberFileSignatures(item);
    }
  }
}

export const fileSignature = (name: string): string | undefined =>
  signatures.get(name);
