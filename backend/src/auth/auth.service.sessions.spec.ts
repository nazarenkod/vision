import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

/*
 * The life of a sign-in (052) as states: open → ended by signing out / ended by a new password /
 * expired and swept. Real tokens, and a small in-memory database that applies the same filters the
 * service sends, so the tests check who can still sign in rather than which calls were made.
 */

interface SessionRow {
  id: string;
  userId: string;
  expiresAt: Date;
  endedAt: Date | null;
}

function fakeDatabase(users: Array<Pick<User, 'id' | 'email' | 'tokensValidAfter'>>) {
  const sessions: SessionRow[] = [];
  // only the filter shapes AuthService sends: equality, null, { lt }, { not }
  const matches = (row: SessionRow, where: Record<string, unknown>) =>
    Object.entries(where).every(([key, condition]) => {
      const value = row[key as keyof SessionRow];
      if (condition && typeof condition === 'object' && !(condition instanceof Date)) {
        const c = condition as { lt?: Date; not?: unknown };
        if ('lt' in c) return value instanceof Date && value < c.lt;
        if ('not' in c) return value !== c.not;
      }
      return value === condition;
    });
  const prisma = {
    session: {
      create: async ({ data }: { data: Omit<SessionRow, 'endedAt'> }) => {
        const row = { ...data, endedAt: null };
        sessions.push(row);
        return row;
      },
      findUnique: async ({ where }: { where: { id: string } }) => sessions.find((s) => s.id === where.id) ?? null,
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Partial<SessionRow> }) => {
        const hit = sessions.filter((s) => matches(s, where));
        hit.forEach((s) => Object.assign(s, data));
        return { count: hit.length };
      },
      deleteMany: async ({ where }: { where: Record<string, unknown> }) => {
        const keep = sessions.filter((s) => !matches(s, where));
        const count = sessions.length - keep.length;
        sessions.splice(0, sessions.length, ...keep);
        return { count };
      },
    },
    user: {
      findUnique: async ({ where }: { where: { email: string } }) => users.find((u) => u.email === where.email) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: Partial<User> }) => {
        const user = users.find((u) => u.id === where.id);
        Object.assign(user, data);
        return { id: user.id };
      },
    },
  };
  return { prisma: prisma as unknown as PrismaService, sessions };
}

const SECRET = 'test-secret';
const anna = { id: 'u-anna', email: 'anna@example.com', tokensValidAfter: null };
const bohdan = { id: 'u-bohdan', email: 'bohdan@example.com', tokensValidAfter: null };

function setup(expiresIn: number | undefined = 3600) {
  const users = [{ ...anna }, { ...bohdan }];
  const db = fakeDatabase(users);
  const jwt = new JwtService({ secret: SECRET, signOptions: expiresIn ? { expiresIn } : {} });
  const service = new AuthService(jwt, db.prisma);
  const signIn = (user: { email: string }) => service.signToken(user as User);
  const opens = async (token: string) => {
    const result = await service.userForToken(await service.verifyToken(token));
    return 'user' in result ? result.user.email : result.problem;
  };
  return { service, jwt, db, users, signIn, opens };
}

describe('AuthService sign-in lifecycle (052)', () => {
  it('opens the person of a fresh sign-in, and only that person', async () => {
    const { signIn, opens } = setup();

    expect(await opens(await signIn(anna))).toBe(anna.email);
    expect(await opens(await signIn(bohdan))).toBe(bohdan.email);
  });

  it('ends only the signed-out sign-in, the other devices stay signed in', async () => {
    const { service, signIn, opens } = setup();
    const laptop = await signIn(anna);
    const phone = await signIn(anna);

    await service.endSession(anna.id, service.sessionIdOf(`Bearer ${laptop}`));

    expect(await opens(laptop)).toBe('ended');
    expect(await opens(phone)).toBe(anna.email);
  });

  it("cannot end someone else's sign-in by naming its session", async () => {
    // the session id is in the token, so anyone holding a token knows one; ending must be scoped to the owner
    const { service, signIn, opens } = setup();
    const bohdanToken = await signIn(bohdan);

    await service.endSession(anna.id, service.sessionIdOf(`Bearer ${bohdanToken}`));

    expect(await opens(bohdanToken)).toBe(bohdan.email);
  });

  it('ends every sign-in of the person on a new password but the one that changed it', async () => {
    const { service, signIn, opens } = setup();
    const here = await signIn(anna);
    const elsewhere = await signIn(anna);
    const someoneElse = await signIn(bohdan);

    await service.endSessions(anna.id, service.sessionIdOf(`Bearer ${here}`));

    expect(await opens(here)).toBe(anna.email);
    expect(await opens(elsewhere)).toBe('ended');
    expect(await opens(someoneElse)).toBe(bohdan.email);
  });

  it('ends every sign-in when a new password keeps none', async () => {
    // an admin resetting the password, or a token from before sessions changing it
    const { service, signIn, opens } = setup();
    const a = await signIn(anna);
    const b = await signIn(anna);

    await service.endSessions(anna.id);

    expect([await opens(a), await opens(b)]).toEqual(['ended', 'ended']);
  });

  it('signs out a token from before sessions by ending all such old tokens of the person', async () => {
    const { service, jwt, opens } = setup();
    // old tokens carry no sid; issued a minute ago so the whole-second rule cannot keep it
    const old = jwt.sign({ email: anna.email, iat: Math.floor(Date.now() / 1000) - 60 });
    expect(await opens(old)).toBe(anna.email);

    await service.endSession(anna.id, service.sessionIdOf(`Bearer ${old}`));

    expect(await opens(old)).toBe('stale');
  });

  it('opens nothing for a token whose session row is gone', async () => {
    const { db, signIn, opens } = setup();
    const token = await signIn(anna);
    db.sessions.length = 0;

    expect(await opens(token)).toBe('unknown-session');
  });

  it('opens nothing once the person is deleted', async () => {
    const { users, signIn, opens } = setup();
    const token = await signIn(anna);
    users.splice(0, 1);

    expect(await opens(token)).toBe('no-user');
  });

  it('keeps the row of a sign-in until its token expires', async () => {
    const { db, jwt, signIn } = setup(3600);
    const token = await signIn(anna);
    const { exp } = jwt.decode(token) as { exp: number };

    expect(db.sessions[0].expiresAt.getTime()).toBe(exp * 1000);
  });

  it("sweeps the person's expired sign-in rows on the next sign-in and leaves the rest", async () => {
    const { db, signIn } = setup();
    const past = new Date(Date.now() - 1000);
    const future = new Date(Date.now() + 3600_000);
    db.sessions.push(
      { id: 'anna-expired', userId: anna.id, expiresAt: past, endedAt: null },
      { id: 'anna-live', userId: anna.id, expiresAt: future, endedAt: null },
      { id: 'bohdan-expired', userId: bohdan.id, expiresAt: past, endedAt: null }
    );

    await signIn(anna);

    // someone else's expired rows wait for their own sign-in
    expect(db.sessions.map((s) => s.id)).toEqual(expect.arrayContaining(['anna-live', 'bohdan-expired']));
    expect(db.sessions.map((s) => s.id)).not.toContain('anna-expired');
    expect(db.sessions).toHaveLength(3);
  });

  it('rejects a token signed with another secret or tampered with', async () => {
    const { service, signIn } = setup();
    const forged = new JwtService({ secret: 'not-ours' }).sign({ email: anna.email });
    const token = await signIn(anna);
    const [header, , signature] = token.split('.');
    const otherBody = Buffer.from(JSON.stringify({ email: bohdan.email })).toString('base64url');

    await expect(service.verifyToken(forged)).rejects.toThrow();
    await expect(service.verifyToken(`${header}.${otherBody}.${signature}`)).rejects.toThrow();
  });
});

describe('AuthService.sessionIdOf', () => {
  const { service, jwt } = setup();
  const withSid = jwt.sign({ email: anna.email, sid: 's-1' });

  // equivalence classes of the Authorization header
  it.each([
    ['a bearer token with a session', `Bearer ${withSid}`, 's-1'],
    ['the scheme in any case', `bearer ${withSid}`, 's-1'],
    ['no header', undefined, undefined],
    ['an empty header', '', undefined],
    ['another scheme', `Basic ${withSid}`, undefined],
    ['the scheme without a token', 'Bearer ', undefined],
    ['a token that is not a JWT', 'Bearer not-a-token', undefined],
    ['a token from before sessions', `Bearer ${jwt.sign({ email: anna.email })}`, undefined],
    ['a sid that is not text', `Bearer ${jwt.sign({ email: anna.email, sid: 42 })}`, undefined],
  ])('names the session for %s', (_case, header, expected) => {
    expect(service.sessionIdOf(header)).toBe(expected);
  });
});

describe('AuthService keys and passwords', () => {
  const { service } = setup();

  it('shows a new key once and stores only what cannot sign in', () => {
    const { key, stored } = service.generateApiKey();

    expect(stored.apiKey).not.toContain(key);
    expect(key.endsWith(stored.apiKeyEnding)).toBe(true);
    expect(stored.apiKeyEnding.length).toBeLessThan(key.length / 2);
  });

  it('never hands out the same key twice', () => {
    const keys = new Set(Array.from({ length: 50 }, () => service.generateApiKey().key));
    expect(keys.size).toBe(50);
  });

  it('accepts the password it hashed and nothing close to it', async () => {
    const hashed = await service.encryptPassword('Correct horse 1');

    expect(hashed).not.toContain('Correct horse 1');
    expect(await service.compare('Correct horse 1', hashed)).toBe(true);
    expect(await service.compare('correct horse 1', hashed)).toBe(false);
    expect(await service.compare('Correct horse 1 ', hashed)).toBe(false);
    expect(await service.compare('', hashed)).toBe(false);
  });
});
