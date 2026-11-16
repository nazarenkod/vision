import { execSync } from 'child_process';
import { randomBytes } from 'crypto';
import { secretProblems } from './server-secrets';

const strong = () => randomBytes(32).toString('base64');
const env = (jwt: string | undefined, key: string | undefined) => ({ JWT_SECRET: jwt, VISION_SECRET_KEY: key });

describe('secrets the server starts with (051)', () => {
  it('takes the secrets the instructions make', () => {
    // openssl rand -base64 32, as DEPLOY.md says, and secrets.token_urlsafe(32) of vision-convert-env.py
    expect(secretProblems(env(strong(), strong()))).toEqual([]);
    expect(secretProblems(env(randomBytes(32).toString('base64url'), strong()))).toEqual([]);
    const fromOpenssl = (() => {
      try {
        return execSync('openssl rand -base64 32', { encoding: 'utf8' }).trim();
      } catch {
        return strong();
      }
    })();
    expect(secretProblems(env(fromOpenssl, strong()))).toEqual([]);
  });

  it('refuses a secret from the examples and the docs', () => {
    for (const known of ['change-me', 'change-me-to-a-long-random-string', 'change-me-to-another-long-random-string']) {
      const problems = secretProblems(env(known, strong()));
      expect(problems).toHaveLength(1);
      expect(problems[0]).toContain('JWT_SECRET is a value from an example');
      expect(problems[0]).toContain('openssl rand -base64 32');
      expect(secretProblems(env(strong(), ` ${known.toUpperCase()} `))[0]).toContain('VISION_SECRET_KEY is a value');
    }
  });

  it('refuses a secret shorter than 32 characters', () => {
    expect(secretProblems(env('a'.repeat(31), strong()))).toEqual([
      'JWT_SECRET is shorter than 32 characters: replace it with a new random one (openssl rand -base64 32)',
    ]);
    // the length counts after trimming, as the key itself is read
    expect(secretProblems(env(strong(), `  ${'b'.repeat(31)}  `))[0]).toContain('VISION_SECRET_KEY is shorter');
    expect(secretProblems(env('a'.repeat(32), strong()))).toEqual([]);
  });

  it('refuses the same value for both secrets', () => {
    const same = strong();
    expect(secretProblems(env(same, same))).toEqual([
      expect.stringContaining('JWT_SECRET and VISION_SECRET_KEY are the same'),
    ]);
  });

  it('names a secret that is not set', () => {
    expect(secretProblems(env(undefined, strong()))[0]).toContain('JWT_SECRET is not set');
    expect(secretProblems(env(strong(), '   '))[0]).toContain('VISION_SECRET_KEY is not set');
  });
});
