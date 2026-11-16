import { msUntilExpiry, tokenFromHandshake } from './events-auth';

describe('tokenFromHandshake', () => {
  it('takes the token from the handshake auth', () => {
    expect(tokenFromHandshake({ token: 'abc' })).toBe('abc');
  });

  it('finds no token in an empty or malformed auth', () => {
    expect(tokenFromHandshake(undefined)).toBeUndefined();
    expect(tokenFromHandshake({})).toBeUndefined();
    expect(tokenFromHandshake({ token: '' })).toBeUndefined();
    expect(tokenFromHandshake({ token: 42 })).toBeUndefined();
    expect(tokenFromHandshake('abc')).toBeUndefined();
  });
});

describe('msUntilExpiry', () => {
  it('counts the time left until the token expires', () => {
    expect(msUntilExpiry(1_000, 999_000)).toBe(1_000);
    expect(msUntilExpiry(1_000, 1_500_000)).toBe(0);
  });

  it('sets no timer for a token without an expiry', () => {
    expect(msUntilExpiry(undefined, 0)).toBeUndefined();
  });

  it('keeps a long lifetime within what a timer can wait', () => {
    expect(msUntilExpiry(90 * 24 * 3600, 0)).toBe(2 ** 31 - 1);
  });
});
