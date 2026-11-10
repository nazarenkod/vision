import { decryptSecret, encryptSecret, isEncrypted, secretKeyFrom, serverSecretKey } from './secret-box';

const key = secretKeyFrom('a long random string for tests')!;

describe('secret box', () => {
  it('keeps no secret readable in what it stores', () => {
    const stored = encryptSecret('ATATT3xFfGF0-jira-token', key);
    expect(isEncrypted(stored)).toBe(true);
    expect(stored).not.toContain('ATATT3xFfGF0');
    expect(decryptSecret(stored, key)).toBe('ATATT3xFfGF0-jira-token');
    // the same secret twice is not the same text: nothing to compare between rows
    expect(encryptSecret('ATATT3xFfGF0-jira-token', key)).not.toBe(stored);
  });

  it('reads nothing with another key or from a damaged value', () => {
    const stored = encryptSecret('token', key);
    expect(decryptSecret(stored, secretKeyFrom('another key')!)).toBeNull();
    expect(decryptSecret(stored.slice(0, -4) + 'AAAA', key)).toBeNull();
    expect(decryptSecret('plain token', key)).toBeNull();
  });

  // GCM takes a shortened tag unless told its length, and a 4-byte tag is guessed in 2^32 tries
  it('reads nothing when the authentication tag is cut short', () => {
    const [iv, tag, data] = encryptSecret('token', key).slice('enc:v1:'.length).split(':');
    const short = Buffer.from(tag, 'base64url').subarray(0, 4).toString('base64url');
    expect(decryptSecret(`enc:v1:${iv}:${short}:${data}`, key)).toBeNull();
  });

  it('refuses to start without VISION_SECRET_KEY', () => {
    expect(() => serverSecretKey({})).toThrow(/VISION_SECRET_KEY is not set/);
    expect(() => serverSecretKey({ VISION_SECRET_KEY: '  ' })).toThrow(/VISION_SECRET_KEY/);
    expect(serverSecretKey({ VISION_SECRET_KEY: 'x' })).toHaveLength(32);
  });
});
