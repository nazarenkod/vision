import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

/**
 * Secrets at rest (044): personal Jira tokens and Gemini keys, and a project's Gemini key, are
 * stored encrypted with a key that lives in the server's settings, never in the database. A dump
 * of the database then gives no access to Jira or Gemini.
 */
const PREFIX = 'enc:v1:';
const TAG_LENGTH = 16;

export const SECRET_KEY_VARIABLE = 'VISION_SECRET_KEY';

/** The 256-bit key from the setting, whatever its length; null when it is not set. */
export function secretKeyFrom(value: string | undefined): Buffer | null {
  return value && value.trim() ? createHash('sha256').update(value.trim()).digest() : null;
}

export const isEncrypted = (value: string | null | undefined): boolean => !!value && value.startsWith(PREFIX);

export function encryptSecret(plain: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return PREFIX + [iv, cipher.getAuthTag(), data].map((part) => part.toString('base64url')).join(':');
}

/**
 * The secret, or null when it cannot be read: not encrypted with this key (the key was changed),
 * or damaged. Callers then treat it as not set, and the person enters it again.
 */
export function decryptSecret(stored: string | null | undefined, key: Buffer): string | null {
  if (!stored || !isEncrypted(stored)) return null;
  try {
    const [iv, tag, data] = stored
      .slice(PREFIX.length)
      .split(':')
      .map((part) => Buffer.from(part, 'base64url'));
    // without the length GCM also takes a shortened tag, which is far easier to forge
    const decipher = createDecipheriv('aes-256-gcm', key, iv, { authTagLength: TAG_LENGTH });
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

/** The key the server runs with; it does not start without one (REQ-044-03). */
export function serverSecretKey(env: NodeJS.ProcessEnv = process.env): Buffer {
  const key = secretKeyFrom(env[SECRET_KEY_VARIABLE]);
  if (!key) {
    throw new Error(
      `${SECRET_KEY_VARIABLE} is not set: set it to a long random string (e.g. openssl rand -base64 32) and keep it, ` +
        'or the stored Jira tokens and Gemini keys cannot be read'
    );
  }
  return key;
}

/** A secret to store, sealed with the server's key. */
export const sealSecret = (plain: string, env: NodeJS.ProcessEnv = process.env): string =>
  encryptSecret(plain, serverSecretKey(env));

/** A stored secret back as plain text with the server's key; null when it is not set or cannot be read. */
export const openSecret = (stored: string | null | undefined, env: NodeJS.ProcessEnv = process.env): string | null =>
  decryptSecret(stored, serverSecretKey(env));
