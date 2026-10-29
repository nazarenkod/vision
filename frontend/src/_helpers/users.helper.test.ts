import { filterUsers, lastSignInLabel } from "./users.helper";

const people = [
  {
    firstName: "Anna",
    lastName: "Petrenko",
    email: "anna.petrenko@company.com",
  },
  { firstName: "Ivan", lastName: "Bondar", email: "ivan.bondar@company.com" },
  { firstName: "QA", lastName: "Guest", email: "qa.guest@company.com" },
];

describe("users", () => {
  it("finds people by first name, last name or email, any case", () => {
    expect(filterUsers(people, "bond").map((p) => p.firstName)).toEqual([
      "Ivan",
    ]);
    expect(filterUsers(people, "ANNA").map((p) => p.firstName)).toEqual([
      "Anna",
    ]);
    expect(filterUsers(people, "qa.guest@").map((p) => p.firstName)).toEqual([
      "QA",
    ]);
    expect(filterUsers(people, "company")).toHaveLength(3);
    expect(filterUsers(people, "  ")).toHaveLength(3);
    expect(filterUsers(people, "nobody")).toEqual([]);
  });

  it("shows a dash for someone who has not signed in", () => {
    expect(lastSignInLabel(null)).toBe("—");
    expect(lastSignInLabel(undefined)).toBe("—");
    expect(lastSignInLabel("2026-10-29T08:00:00Z")).not.toBe("—");
  });
});
