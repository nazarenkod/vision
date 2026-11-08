import { SECRET_KEY_VARIABLE } from './secret-box';

/*
 * The two secrets the server runs with (051): the one that signs sign-ins and the one that seals
 * Jira tokens and Gemini keys. A value from an example signs an admin's sign-in for anyone who
 * read the example (VIS-SEC-002), so the API does not start with one.
 */

export const JWT_SECRET_VARIABLE = 'JWT_SECRET';
export const MIN_SECRET_LENGTH = 32;

// what the examples, the docs and the scripts of Vision and of the inherited VRT ever held
const KNOWN_VALUES = new Set(
  [
    'change-me',
    'changeme',
    'change-me-to-a-long-random-string',
    'change-me-to-another-long-random-string',
    'jwtPrivateKey',
    'secret',
    'dev-secret',
    'control-jwt-secret',
    'control-secret-key',
  ].map((value) => value.toLowerCase())
);

const HOW_TO_MAKE = 'openssl rand -base64 32';

/** Why the server must not start with these secrets; empty when it may. */
export function secretProblems(env: NodeJS.ProcessEnv = process.env): string[] {
  const problems: string[] = [];
  const values: Record<string, string> = {};
  for (const variable of [JWT_SECRET_VARIABLE, SECRET_KEY_VARIABLE]) {
    // trimmed, as the key itself is read (044)
    const value = (env[variable] ?? '').trim();
    values[variable] = value;
    if (!value) {
      problems.push(`${variable} is not set: set it to a long random string (${HOW_TO_MAKE})`);
    } else if (KNOWN_VALUES.has(value.toLowerCase())) {
      problems.push(`${variable} is a value from an example: replace it with a new random one (${HOW_TO_MAKE})`);
    } else if (value.length < MIN_SECRET_LENGTH) {
      problems.push(
        `${variable} is shorter than ${MIN_SECRET_LENGTH} characters: replace it with a new random one (${HOW_TO_MAKE})`
      );
    }
  }
  const [jwt, key] = [values[JWT_SECRET_VARIABLE], values[SECRET_KEY_VARIABLE]];
  if (jwt && jwt === key) {
    problems.push(
      `${JWT_SECRET_VARIABLE} and ${SECRET_KEY_VARIABLE} are the same: each needs its own random value (${HOW_TO_MAKE})`
    );
  }
  return problems;
}
