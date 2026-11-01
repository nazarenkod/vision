// Who may open the events socket (spec 032): the same login token the API takes.

// setTimeout fires at once for delays above this; a longer token lifetime just
// means one early disconnect, after which the client reconnects with the same token.
const MAX_TIMER_MS = 2 ** 31 - 1;

/** The login token a client put in the socket.io handshake `auth`, if any. */
export function tokenFromHandshake(auth: unknown): string | undefined {
  if (!auth || typeof auth !== 'object') return undefined;
  const token = (auth as Record<string, unknown>).token;
  return typeof token === 'string' && token.length > 0 ? token : undefined;
}

/** Milliseconds until a JWT `exp` (seconds since epoch); undefined for a token without one. */
export function msUntilExpiry(exp: unknown, now: number): number | undefined {
  if (typeof exp !== 'number') return undefined;
  return Math.min(MAX_TIMER_MS, Math.max(0, exp * 1000 - now));
}
