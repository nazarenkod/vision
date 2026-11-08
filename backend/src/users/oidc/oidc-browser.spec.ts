import { browserNonce, readStateCookie, stateCookieValue } from './oidc-browser';

describe('the browser a sign-in through SSO started in (052)', () => {
  it('takes only values the interface makes', () => {
    expect(browserNonce('Zm9vYmFyYmF6cXV4MTIzNDU2')).toBe('Zm9vYmFyYmF6cXV4MTIzNDU2');
    for (const value of ['', 'short', 'a.b.c.d.e.f.g.h.i.j.k', 'x'.repeat(200), '<script>abc</script>xx', 42, null]) {
      expect(browserNonce(value)).toBeNull();
    }
  });

  it('keeps state, PKCE and the value in the cookie, and reads cookies from before it', () => {
    const started = { state: 'st', codeVerifier: 'cv', nonce: 'Zm9vYmFyYmF6cXV4MTIzNDU2' };
    expect(readStateCookie(stateCookieValue(started))).toEqual(started);
    // a sign-in started by the interface before this version has no value
    expect(readStateCookie('st.cv')).toEqual({ state: 'st', codeVerifier: 'cv', nonce: null });
    expect(readStateCookie('broken')).toBeNull();
    expect(readStateCookie(null)).toBeNull();
  });
});
