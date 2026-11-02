/**
 * The email an account is stored under. Local, LDAP and SSO accounts all keep
 * it trimmed and lower case, so a second account cannot differ only in case.
 */
export function accountEmail(email: string): string {
  return email.trim().toLowerCase();
}
