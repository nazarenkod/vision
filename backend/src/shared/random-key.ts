import { randomBytes } from 'crypto';

// Crockford's base32: no I, L, O, U, so a key read aloud or retyped is not misread
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * A random key in the format API keys and stored file names always had (28 characters of
 * Crockford's base32, as uuid-apikey made them): 140 random bits. 256 is a multiple of 32, so
 * every character is equally likely.
 */
export function newRandomKey(): string {
  return Array.from(randomBytes(28), (byte) => CROCKFORD[byte & 31]).join('');
}

/** Whether a project reference is an id rather than a name: dashes where a UUID has them, 32 hex digits. */
export function looksLikeUuid(value: string): boolean {
  if (!value) return false;
  const dashes = value[8] === '-' && value[13] === '-' && value[18] === '-';
  const hex = value.replace(/-/g, '');
  return dashes && hex.length === 32 && /^[0-9A-Fa-f]+$/.test(hex);
}
