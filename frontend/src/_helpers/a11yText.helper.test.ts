import { DICTIONARIES, english, Text } from "../i18n/dictionaries";
import { translate } from "../i18n/translate";
import { a11yMessage, a11yTitle } from "./a11yText.helper";

const ukrainian: Text = (key, params) =>
  translate(DICTIONARIES, "uk", key, params);

describe("a11yText", () => {
  it("shows the rule's title in the interface language", () => {
    expect(
      a11yTitle(ukrainian, {
        rule: "touch-target",
        title: "Touch target too small",
      }),
    ).toBe("Замала область дотику");
  });

  it("translates the server's sentence and keeps the element as it is", () => {
    const violation = {
      rule: "touch-target" as const,
      message:
        'Button "Пошук" (Пошук#search#PbIcon) is 40 × 26 dp, minimum is 40 × 40 dp.',
    };
    expect(a11yMessage(ukrainian, violation)).toBe(
      'Button "Пошук" (Пошук#search#PbIcon): 40 × 26 dp, мінімум — 40 × 40 dp.',
    );
    expect(a11yMessage(english, violation)).toBe(violation.message);
  });

  it("reads every rule's English sentence back unchanged", () => {
    const messages = {
      "missing-label":
        "ImageView (id/close) has nothing for TalkBack to read out.",
      "low-contrast": 'TextView "Ok": 2.3 : 1, needs 4.5 : 1.',
      "input-without-label":
        "EditText (id/amount) gives no clue what to enter.",
      "duplicate-label":
        '2 controls are announced as "історія"; users cannot tell them apart.',
      "redundant-role":
        '"Close button" already gets its role announced; drop words like "button" or "image".',
      "not-accessible": "Button has isAccessibilityElement = false.",
    } as const;
    for (const [rule, message] of Object.entries(messages)) {
      const violation = { rule: rule as keyof typeof messages, message };
      expect(a11yMessage(english, violation)).toBe(message);
      expect(a11yMessage(ukrainian, violation)).not.toBe(message);
    }
  });

  it("uses Ukrainian plural forms for the count of controls", () => {
    expect(
      a11yMessage(ukrainian, {
        rule: "duplicate-label",
        message:
          '5 controls are announced as "історія"; users cannot tell them apart.',
      }),
    ).toBe(
      "5 елементів озвучуються як «історія»; користувач не відрізнить їх.",
    );
  });

  it("shows a sentence it does not know as the server wrote it", () => {
    const violation = {
      rule: "touch-target" as const,
      message: "Something new.",
    };
    expect(a11yMessage(ukrainian, violation)).toBe("Something new.");
  });
});
