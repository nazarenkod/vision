import { apiKeyEnding, hashApiKey, isHashedApiKey } from './api-key-hash';
import { newRandomKey } from './random-key';

describe('API key hash', () => {
  it('finds a key by its hash and cannot get it back', () => {
    const key = newRandomKey();
    const stored = hashApiKey(key);
    expect(stored).toBe(hashApiKey(key));
    expect(stored).not.toContain(key);
    expect(isHashedApiKey(stored)).toBe(true);
    // a key as VRT stores it is not a hash: it gets annulled on the first start
    expect(isHashedApiKey(key)).toBe(false);
    expect(apiKeyEnding(key)).toBe(key.slice(-4));
  });
});
