/**
 * The email an account is stored under. Local, LDAP and SSO accounts all keep
 * it trimmed and lower case, so a second account cannot differ only in case.
 */
export function accountEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** A local account's password is long enough: 12 characters or more (045). */
export const MIN_PASSWORD_LENGTH = 12;

export function passwordProblem(password: unknown): string | null {
  if (typeof password !== 'string' || !password.trim()) return 'Password is required';
  return password.length < MIN_PASSWORD_LENGTH ? `The password needs at least ${MIN_PASSWORD_LENGTH} characters` : null;
}
