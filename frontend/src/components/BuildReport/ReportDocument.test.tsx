import React from "react";
import { render, screen, within } from "@testing-library/react";
import { ReportDocument } from "./ReportDocument";
import { formatDate } from "../../i18n/translate";
import {
  ALL_SECTIONS,
  PublicReport,
  SHORT_SECTIONS,
} from "../../types/buildOverview";

jest.mock("../../services", () => ({
  staticService: { getImage: (name: string) => `/images/${name}` },
}));

const outcome = { total: 16, changed: 2, new: 0, rejected: 0, passed: 14 };
const report: PublicReport = {
  state: "ok",
  createdBy: "Anna Petrenko",
  overview: {
    verdict: "waiting",
    counts: {
      total: 47,
      changed: 4,
      new: 1,
      rejected: 0,
      passed: 42,
      waiting: 5,
      a11yNew: 5,
      bugs: 1,
    },
    progress: { decided: 1, needed: 6, people: [] },
    devices: [
      {
        device: "PIXEL_4_XL",
        os: "AOS 14",
        browser: "",
        viewport: "",
        screen: "1080×2400",
        a11yNew: 3,
        ...outcome,
      },
    ],
    features: [{ name: "Checkout", grouped: true, bugs: 1, ...outcome }],
    quietFeatures: { count: 4, screens: 26, features: [] },
    bugs: [
      {
        kind: "visual",
        jiraKey: "P24MOB-14231",
        jiraUrl: null,
        summary: "Error text wraps",
        testRunId: "a",
        isNew: true,
      },
    ],
    previous: { number: 127, changed: 4, added: 1, gone: 0 },
    build: {
      id: "b",
      number: 128,
      branchName: "release/7.4",
      ciBuildId: "android-nightly-4821",
      projectId: "p",
      projectName: "Mobile Shop",
      createdAt: "2026-10-31T10:42:00Z",
      updatedAt: "2026-10-31T10:48:00Z",
    },
    asOf: "2026-10-31T11:05:00Z",
  },
  changes: [
    {
      testRunId: "a",
      name: "Login. Error state",
      device: "iPhone 15",
      os: "iOS 17",
      status: "unresolved",
      diffPercent: 6.4,
      imageName: "a.png",
      baselineName: "a-base.png",
      diffName: "a-diff.png",
    },
  ],
  moreChanges: 3,
  a11y: [
    {
      testRunId: "a",
      name: "Login. Error state",
      device: "iPhone 15",
      newCount: 2,
    },
  ],
};

const shown = () =>
  screen
    .queryAllByTestId(/^reportSection-/)
    .map((section) => section.dataset.testid?.replace("reportSection-", ""));

describe("ReportDocument", () => {
  it("Short has Summary, Changes and Jira bugs; Full adds the rest", () => {
    const { rerender } = render(
      <ReportDocument
        report={report}
        sections={SHORT_SECTIONS}
        language="en"
      />,
    );
    expect(shown()).toEqual(["sum", "chg", "bugs"]);
    rerender(
      <ReportDocument report={report} sections={ALL_SECTIONS} language="en" />,
    );
    expect(shown()).toEqual(["sum", "chg", "bugs", "dev", "feat", "a11y"]);
  });

  it("says how many checks a feature holds and not for a check on its own", () => {
    const overview = report.overview!;
    render(
      <ReportDocument
        report={{
          ...report,
          overview: {
            ...overview,
            features: [
              ...overview.features,
              {
                name: "Login. Error state",
                grouped: false,
                bugs: 0,
                ...outcome,
              },
            ],
          },
        }}
        sections={ALL_SECTIONS}
        language="uk"
      />,
    );
    const feat = screen.getByTestId("reportSection-feat");
    expect(feat).toHaveTextContent("Checkout · 16 перевірок");
    expect(feat).toHaveTextContent(/Login\. Error state(?! ·)/);
  });

  it("renders in the report language, not the interface one", () => {
    render(
      <ReportDocument
        report={report}
        sections={SHORT_SECTIONS}
        language="uk"
      />,
    );
    expect(screen.getByText("Звіт збірки")).toBeInTheDocument();
    // the build's state in the words of its header, not a third wording
    expect(screen.getByText("Чекає рішення")).toBeInTheDocument();
    expect(screen.getByText("ще 3")).toBeInTheDocument();
    expect(screen.queryByText("Build report")).toBeNull();
  });

  it("summary names the project, build, branch, time, devices and numbers", () => {
    render(<ReportDocument report={report} sections={["sum"]} language="en" />);
    expect(
      screen.getByRole("heading", { name: "Mobile Shop · #128 · release/7.4" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/1 device · android-nightly-4821$/),
    ).toBeInTheDocument();
    expect(screen.getByTestId("reportAsOf")).toHaveTextContent("As of");
    const summary = screen.getByTestId("reportSection-sum");
    for (const label of [
      "47",
      "Screens",
      "5",
      "To review",
      "Rejected",
      "New accessibility issues",
      "Jira bugs",
    ]) {
      expect(summary).toHaveTextContent(label);
    }
    expect(summary).toHaveTextContent("Since #127: 4 changed, 1 new");
  });

  it("gives when the build ran as its period and the state's time once", () => {
    render(<ReportDocument report={report} sections={["sum"]} language="en" />);
    const start = new Date("2026-10-31T10:42:00Z");
    const end = new Date("2026-10-31T10:48:00Z");
    const time = (value: Date) =>
      formatDate(value, "en", {
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
      });
    expect(screen.getByTestId("reportDocument")).toHaveTextContent(
      `${time(start)} – ${time(end)}`,
    );
    expect(screen.getAllByText(/^As of/)).toHaveLength(1);
  });

  it("shows new screenshots without a baseline and names statuses as the app does", () => {
    render(
      <ReportDocument
        report={{
          ...report,
          changes: [
            ...report.changes!,
            {
              testRunId: "n",
              name: "Onboarding",
              device: "Pixel 7",
              os: "Android 14",
              status: "new",
              diffPercent: null,
              imageName: "n.png",
              baselineName: null,
              diffName: null,
            },
          ],
        }}
        sections={["chg"]}
        language="uk"
      />,
    );
    const [changed, fresh] = screen.getAllByTestId("reportChange");
    expect(changed).toHaveTextContent("чекає рішення");
    // the difference in the report's language
    expect(
      within(changed)
        .getAllByTestId("deviceTag")
        .map((tag) => tag.textContent),
    ).toEqual(["iOS 17", "iPhone 15"]);
    expect(changed).toHaveTextContent("6,40%");
    expect(fresh).toHaveTextContent("новий");
    expect(fresh.querySelectorAll("img")).toHaveLength(1);
  });

  it("explains the bars and leaves zeros out of the tables", () => {
    render(
      <ReportDocument
        report={{
          ...report,
          overview: {
            ...report.overview!,
            features: [
              { name: "Checkout", grouped: true, bugs: 0, ...outcome },
            ],
          },
        }}
        sections={["dev", "feat"]}
        language="uk"
      />,
    );
    expect(screen.getByTestId("resultLegend")).toHaveTextContent("змінені");
    expect(screen.getAllByTestId("resultLegend")).toHaveLength(1);
    expect(
      screen.getAllByRole("img", { name: "2 змінені · 14 без змін" }),
    ).not.toHaveLength(0);
    const devices = screen.getByTestId("reportSection-dev");
    // tags OS first, outlined so they print without backgrounds (spec 037)
    expect(
      within(devices)
        .getAllByTestId("deviceTag")
        .map((tag) => tag.textContent),
    ).toEqual(["AOS 14", "PIXEL_4_XL", "1080×2400"]);
    expect(within(devices).getAllByTestId("deviceTag")[0]).toHaveAttribute(
      "title",
      "ОС",
    );
    // the device has 3 new issues, the feature no bugs: a dash, not a 0
    expect(screen.getByTestId("reportSection-feat")).toHaveTextContent("—");
  });

  it("says first build on the branch when there is no earlier one", () => {
    render(
      <ReportDocument
        report={{
          ...report,
          overview: { ...report.overview!, previous: null },
        }}
        sections={["sum"]}
        language="en"
      />,
    );
    expect(screen.getByTestId("reportSection-sum")).toHaveTextContent(
      "First build on this branch",
    );
  });
});
