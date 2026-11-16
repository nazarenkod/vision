import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { SECRET_KEY_VARIABLE, serverSecretKey } from '../shared/secret-box';

/**
 * Links to stored images (043). A file opens only with a signature Vision handed out: the HMAC of
 * its name, under a key derived from VISION_SECRET_KEY. It depends on nothing else, so a link
 * copied from the interface works for as long as the file exists, and for no other file. A
 * public report signs with its own token too, so its links die with the report link.
 */

/** The fields that hold the name of a stored image. Trees and reports are read through the API. */
export const FILE_FIELDS = ['imageName', 'diffName', 'baselineName', 'imageThumbnailName', 'diffThumbnailName'];

export const FILE_SIGNATURES = 'fileSignatures';

/** Its own key, apart from the one that seals tokens (044). */
export const fileLinkKey = (secretKey: string): Buffer =>
  createHash('sha256').update(`vision-file-links\n${secretKey.trim()}`).digest();

const mac = (key: Buffer, text: string): string =>
  createHmac('sha256', key).update(text).digest().subarray(0, 16).toString('base64url');

/** The key the server signs links with; like the one that seals tokens, it must be set. */
export function serverFileLinkKey(env: NodeJS.ProcessEnv = process.env): Buffer {
  serverSecretKey(env);
  return fileLinkKey(env[SECRET_KEY_VARIABLE] as string);
}

export const signFile = (name: string, key: Buffer): string => mac(key, `file\n${name}`);

export const signReportFile = (token: string, name: string, key: Buffer): string =>
  `${token}.${mac(key, `report\n${token}\n${name}`)}`;

const same = (a: string, b: string): boolean =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * What a signature opens: the file for anyone, the file while a report link lives, or nothing.
 * The report's token is returned for the caller to check that its link is still valid.
 */
export function readFileSignature(
  name: string,
  signature: string | undefined,
  key: Buffer
): { kind: 'file' } | { kind: 'report'; token: string } | null {
  if (!signature) return null;
  const dot = signature.lastIndexOf('.');
  if (dot < 0) return same(signature, signFile(name, key)) ? { kind: 'file' } : null;
  const token = signature.slice(0, dot);
  return same(signature, signReportFile(token, name, key)) ? { kind: 'report', token } : null;
}

/**
 * The answer with a `fileSignatures` map beside every set of file names in it. Nothing present
 * changes, so the SDK and the CLI read the answers as before.
 */
export function withFileSignatures(value: unknown, sign: (name: string) => string): unknown {
  if (Array.isArray(value)) return value.map((item) => withFileSignatures(item, sign));
  if (!value || typeof value !== 'object' || Buffer.isBuffer(value)) return value;
  // a Date, a stream or a file is sent as it is; only rows and DTOs are walked
  const special = value as { toJSON?: unknown; pipe?: unknown; getStream?: unknown };
  if (
    typeof special.toJSON === 'function' ||
    typeof special.pipe === 'function' ||
    typeof special.getStream === 'function'
  )
    return value;
  const out: Record<string, unknown> = {};
  let signatures: Record<string, string> | null = null;
  for (const [field, item] of Object.entries(value)) {
    out[field] = withFileSignatures(item, sign);
    if (FILE_FIELDS.includes(field) && typeof item === 'string' && item) {
      signatures ??= {};
      signatures[item] = sign(item);
    }
  }
  if (signatures) out[FILE_SIGNATURES] = signatures;
  return out;
}
