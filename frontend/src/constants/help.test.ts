import { DICTIONARIES } from "../i18n/dictionaries";
import { LOGIN_PAGE_STEPS } from "./help";

describe("login tour", () => {
  it("names no account and no password in the login tour", () => {
    for (const dictionary of Object.values(DICTIONARIES)) {
      for (const step of LOGIN_PAGE_STEPS) {
        const text = (dictionary as Record<string, string>)[
          step.content as string
        ];
        expect(text).toBeTruthy();
        // a default account read off the login page is an open door
        expect(text).not.toMatch(/@|123456|password\s*:/i);
      }
    }
  });
});
