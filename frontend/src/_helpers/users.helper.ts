import { User } from "../types";

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
