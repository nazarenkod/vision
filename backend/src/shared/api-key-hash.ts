import { createHash } from 'crypto';

/**
 * API keys are stored as their SHA-256 (044): random 140-bit keys need no slow hash, and lookup
 * by the unique column stays one query. The key itself is shown once, when it is made.
 */
export const HASHED_API_KEY_PREFIX = 'sha256:';
const PREFIX = HASHED_API_KEY_PREFIX;

export const hashApiKey = (key: string): string => PREFIX + createHash('sha256').update(key).digest('hex');

export const isHashedApiKey = (stored: string | null | undefined): boolean => !!stored && stored.startsWith(PREFIX);

/** The last characters, to tell keys apart in the profile. */
export const apiKeyEnding = (key: string): string => key.slice(-4);
