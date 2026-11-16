/*
 * Sign-ins kept in the database (052, VIS-SEC-009). Each sign-in to the interface is a row whose
 * id is in its token (`sid`): signing out ends that row, a new password ends the others, and a
 * token whose row has ended opens nothing, in every API process. A token issued before sessions
 * existed has no `sid`; it holds until the person signs out or changes their password, which
 * moves `tokensValidAfter` past it.
 */

export interface SessionTokenPayload {
  email: string;
  // the session of this sign-in; absent on tokens issued before 052
  sid?: string;
  // seconds since the epoch, as JWT counts them
  iat?: number;
  exp?: number;
}

export interface SessionRow {
  userId: string;
  endedAt: Date | null;
}

export interface SessionOwner {
  id: string;
  tokensValidAfter: Date | null;
}

export type SessionProblem = 'no-user' | 'unknown-session' | 'ended' | 'stale';

/** Why a token opens nothing, or null when it does. */
export function sessionProblem(
  payload: SessionTokenPayload,
  user: SessionOwner | null,
  session: SessionRow | null
): SessionProblem | null {
  if (!user) return 'no-user';
  if (payload.sid) {
    // a session of someone else is no session of this person
    if (!session || session.userId !== user.id) return 'unknown-session';
    return session.endedAt ? 'ended' : null;
  }
  // JWT counts in whole seconds: a token of the same second as the change still holds
  if (user.tokensValidAfter && (payload.iat ?? 0) < Math.floor(user.tokensValidAfter.getTime() / 1000)) {
    return 'stale';
  }
  return null;
}

// a token without an expiry (JWT_LIFE_TIME unset) keeps its row this long
const NO_EXPIRY_MS = 365 * 24 * 60 * 60 * 1000;

/** When the row of a sign-in may go: its token's expiry. */
export function sessionExpiry(exp: number | undefined, now: Date): Date {
  return typeof exp === 'number' ? new Date(exp * 1000) : new Date(now.getTime() + NO_EXPIRY_MS);
}
