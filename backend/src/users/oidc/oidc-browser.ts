/*
 * A sign-in through SSO counts only in the browser tab that started it (052, VIS-SEC-018). The
 * interface makes a random value, keeps it in the tab and sends it to /users/oidc/login; the API
 * keeps it in the state cookie beside state and PKCE and hands it back with the token. A link
 * someone else made carries a token, but not the value this tab keeps, so it signs in nobody.
 */

const NONCE = /^[A-Za-z0-9_-]{16,128}$/;

/** The tab's value if it looks like one the interface makes; null otherwise. */
export function browserNonce(value: unknown): string | null {
  return typeof value === 'string' && NONCE.test(value) ? value : null;
}

export interface OidcBrowserState {
  state: string;
  codeVerifier: string;
  nonce: string | null;
}

// state and the PKCE verifier are base64url: the dot cannot be in them
export const stateCookieValue = ({ state, codeVerifier, nonce }: OidcBrowserState): string =>
  [state, codeVerifier, ...(nonce ? [nonce] : [])].join('.');

export function readStateCookie(value: string | null): OidcBrowserState | null {
  const [state, codeVerifier, nonce] = (value ?? '').split('.');
  if (!state || !codeVerifier) return null;
  return { state, codeVerifier, nonce: browserNonce(nonce) };
}
