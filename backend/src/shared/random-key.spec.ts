import { looksLikeUuid, newRandomKey } from './random-key';

describe('newRandomKey', () => {
  it('keeps the 28-character Crockford format of API keys and file names', () => {
    const keys = Array.from({ length: 1000 }, () => newRandomKey());
    for (const key of keys) expect(key).toMatch(/^[0-9A-HJKMNP-TV-Z]{28}$/);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('looksLikeUuid', () => {
  it('tells a project id from a project name', () => {
    expect(looksLikeUuid('003f5fcf-6c5f-4f1f-a99f-82a697711382')).toBe(true);
    expect(looksLikeUuid('Android app')).toBe(false);
    expect(looksLikeUuid('003f5fcf6c5f4f1fa99f82a697711382')).toBe(false);
    expect(looksLikeUuid('')).toBe(false);
  });
});
