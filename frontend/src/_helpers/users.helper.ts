import { NewAccount, Role, User } from "../types";

/** People whose first name, last name or email holds the text, any case. */
export function filterUsers<
  T extends Pick<User, "firstName" | "lastName" | "email">,
>(users: T[], query: string): T[] {
  const wanted = query.trim().toLowerCase();
  if (!wanted) return users;
  return users.filter((user) =>
    [user.firstName, user.lastName, user.email].some((value) =>
      (value ?? "").toLowerCase().includes(wanted),
    ),
  );
}

export const lastSignInLabel = (
  value: string | null | undefined,
  // the interface passes its own, in the language picked
  format: (value: string) => string = (date) => new Date(date).toLocaleString(),
): string => (value ? format(value) : "—");

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** As the server checks a local account's password (045). */
export const MIN_PASSWORD_LENGTH = 12;

/** New user can be saved: a valid email, a role and a password of 12 characters or more (035, 045). */
export const canCreateAccount = (
  account: Pick<NewAccount, "email" | "role" | "password">,
): boolean =>
  EMAIL.test(account.email.trim()) &&
  account.role in Role &&
  account.password.trim().length > 0 &&
  account.password.length >= MIN_PASSWORD_LENGTH;
