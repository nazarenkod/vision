import { sessionExpiry, sessionProblem } from './sessions';

const user = { id: 'ann', tokensValidAfter: null };
const at = (seconds: number) => new Date(seconds * 1000);

describe('sessions (052)', () => {
  it('opens a sign-in whose session holds', () => {
    expect(sessionProblem({ email: 'a', sid: 's1' }, user, { userId: 'ann', endedAt: null })).toBeNull();
  });

  it('opens nothing for a gone person, an ended, unknown or foreign session', () => {
    expect(sessionProblem({ email: 'a', sid: 's1' }, null, null)).toBe('no-user');
    expect(sessionProblem({ email: 'a', sid: 's1' }, user, { userId: 'ann', endedAt: new Date() })).toBe('ended');
    expect(sessionProblem({ email: 'a', sid: 's1' }, user, null)).toBe('unknown-session');
    expect(sessionProblem({ email: 'a', sid: 's1' }, user, { userId: 'bob', endedAt: null })).toBe('unknown-session');
  });

  it('takes a token from before sessions until the person ends their old tokens', () => {
    expect(sessionProblem({ email: 'a', iat: 1000 }, user, null)).toBeNull();
    const ended = { id: 'ann', tokensValidAfter: at(2000) };
    expect(sessionProblem({ email: 'a', iat: 1999 }, ended, null)).toBe('stale');
    // the same second as the change still holds: JWT counts whole seconds
    expect(sessionProblem({ email: 'a', iat: 2000 }, ended, null)).toBeNull();
    // a session token is judged by its session, not by the moment
    expect(sessionProblem({ email: 'a', sid: 's1', iat: 1 }, ended, { userId: 'ann', endedAt: null })).toBeNull();
  });

  it('keeps the row of a sign-in as long as its token', () => {
    const now = new Date('2026-11-08T10:00:00Z');
    expect(sessionExpiry(Math.floor(now.getTime() / 1000) + 86400, now)).toEqual(new Date('2026-11-09T10:00:00Z'));
    expect(sessionExpiry(undefined, now).getTime()).toBeGreaterThan(now.getTime() + 300 * 86400 * 1000);
  });
});
