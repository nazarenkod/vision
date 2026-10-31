import { reportText } from "./reportText.helper";
import { BuildOverview } from "../types/buildOverview";

const overview: BuildOverview = {
  verdict: "waiting",
  counts: {
    total: 47,
    changed: 4,
    new: 1,
    rejected: 0,
    passed: 42,
    waiting: 5,
    a11yNew: 5,
    bugs: 2,
  },
  progress: { decided: 1, needed: 6, people: [] },
  devices: [
    {
      device: "PIXEL_4_XL",
      os: "AOS 14",
      browser: "",
      viewport: "",
      a11yNew: 3,
      total: 16,
      changed: 2,
      new: 0,
      rejected: 0,
      passed: 14,
    },
    {
      device: "iPhone 15",
      os: "iOS 17",
      browser: "",
      viewport: "",
      a11yNew: 2,
      total: 16,
      changed: 2,
      new: 0,
      rejected: 0,
      passed: 14,
    },
    {
      device: "Galaxy S22",
      os: "AOS 13",
      browser: "",
      viewport: "",
      a11yNew: 0,
      total: 15,
      changed: 0,
      new: 1,
      rejected: 0,
      passed: 14,
    },
  ],
  features: [],
  quietFeatures: { count: 0, screens: 0 },
  bugs: [
    {
      kind: "visual",
      jiraKey: "P24MOB-14231",
      jiraUrl: null,
      summary: "",
      testRunId: "a",
      isNew: true,
    },
    {
      kind: "a11y",
      jiraKey: "P24MOB-14190",
      jiraUrl: null,
      summary: "",
      testRunId: "b",
      isNew: false,
    },
  ],
  previous: null,
  build: {
    id: "b",
    number: 128,
    branchName: "release/7.4",
    ciBuildId: null,
    projectId: "p",
    projectName: "Mobile Shop",
    createdAt: "2026-10-31T10:42:00Z",
    updatedAt: "2026-10-31T10:48:00Z",
  },
  asOf: "2026-10-31T11:05:00Z",
};
const url = "https://vision.local/r/abc";

describe("report text", () => {
  it("writes Slack mrkdwn", () => {
    const text = reportText(overview, "slack", url);
    expect(text.split("\n").slice(0, 5)).toEqual([
      "*Mobile Shop · #128 · release/7.4* — Waiting for review",
      "• 47 screens on 3 devices: 42 passed, 4 changed, 1 new",
      "• Waiting for a decision: 5 · rejected: 0",
      "• Accessibility: 5 new issues",
      "• Jira: P24MOB-14231, P24MOB-14190",
    ]);
    expect(text).toContain(`<${url}|Open the report>`);
  });

  it("writes a Jira list with links", () => {
    const text = reportText(overview, "jira", url);
    expect(text.split("\n")[0]).toBe(
      "Mobile Shop · #128 · release/7.4 — Waiting for review",
    );
    expect(text).toContain("* Jira: P24MOB-14231, P24MOB-14190");
    expect(text).toContain(`\n${url}\n`);
    expect(text).not.toContain("<");
  });

  it("states the time of the state it shows", () => {
    const text = reportText(overview, "slack", url, undefined, "en-GB");
    expect(text.split("\n").at(-1)).toBe(
      `As of ${new Date("2026-10-31T11:05:00Z").toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}`,
    );
  });
});
