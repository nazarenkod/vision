import type { MessageKey, Text } from "../i18n";
import type { A11yViolation } from "../types";

const RULE_KEY: Record<A11yViolation["rule"], MessageKey> = {
  "touch-target": "a11y.rule.touchTarget",
  "low-contrast": "a11y.rule.lowContrast",
  "missing-label": "a11y.rule.missingLabel",
  "input-without-label": "a11y.rule.inputWithoutLabel",
  "duplicate-label": "a11y.rule.duplicateLabel",
  "redundant-role": "a11y.rule.redundantRole",
  "not-accessible": "a11y.rule.notAccessible",
};

/** A finding's title in the interface language; a rule the interface does not know keeps the server's title. */
export const a11yTitle = (
  text: Text,
  violation: Pick<A11yViolation, "rule" | "title">,
) =>
  RULE_KEY[violation.rule] ? text(RULE_KEY[violation.rule]) : violation.title;

type Parse = (
  match: RegExpExecArray,
) => [MessageKey, Record<string, string | number>];

/*
 * The server stores each finding's text in English, in reports already saved
 * too, so the text is read back from those fixed sentences rather than rebuilt
 * from details, which older reports lack. The element itself (class, name, id)
 * is data from the app and stays as it is.
 */
const MESSAGES: Record<A11yViolation["rule"], [RegExp, Parse]> = {
  "touch-target": [
    /^(.+) is (\d+) × (\d+) (\w+), minimum is ([\d.]+) × [\d.]+ \w+\.$/,
    (m) => [
      "a11y.msg.touchTarget",
      {
        element: m[1],
        width: Number(m[2]),
        height: Number(m[3]),
        unit: m[4],
        min: Number(m[5]),
      },
    ],
  ],
  "low-contrast": [
    /^(.+): ([\d.]+) : 1, needs ([\d.]+) : 1\.$/,
    (m) => [
      "a11y.msg.lowContrast",
      { element: m[1], ratio: m[2], required: Number(m[3]) },
    ],
  ],
  "missing-label": [
    /^(.+) has nothing for (\w+) to read out\.$/,
    (m) => ["a11y.msg.missingLabel", { element: m[1], reader: m[2] }],
  ],
  "input-without-label": [
    /^(.+) gives no clue what to enter\.$/,
    (m) => ["a11y.msg.inputWithoutLabel", { element: m[1] }],
  ],
  "duplicate-label": [
    /^(\d+) controls are announced as "(.*)"; users cannot tell them apart\.$/,
    (m) => ["a11y.msg.duplicateLabel", { count: Number(m[1]), label: m[2] }],
  ],
  "redundant-role": [
    /^"(.*)" already gets its role announced; drop words like "button" or "image"\.$/,
    (m) => ["a11y.msg.redundantRole", { label: m[1] }],
  ],
  "not-accessible": [
    /^(.+) has isAccessibilityElement = false\.$/,
    (m) => ["a11y.msg.notAccessible", { element: m[1] }],
  ],
};

/** A finding's text in the interface language; a sentence the interface does not know is shown as the server wrote it. */
export function a11yMessage(
  text: Text,
  violation: Pick<A11yViolation, "rule" | "message">,
): string {
  const known = MESSAGES[violation.rule];
  const match = known?.[0].exec(violation.message);
  if (!known || !match) return violation.message;
  const [key, params] = known[1](match);
  return text(key, params);
}
