import { english, MessageKey, Text } from "../i18n";
import { BuildOverview } from "../types/buildOverview";

// Text of a build report to paste into Slack or a Jira comment (031). Vision
// only copies it (REQ-031-49). Slack reads mrkdwn; Jira gets a plain list with
// bare URLs, which Cloud and Server both show, and Jira keys link themselves.

export type TextFormat = "slack" | "jira";

const time = (iso: string, locale?: string) =>
  new Date(iso).toLocaleString(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export function reportText(
  overview: BuildOverview,
  format: TextFormat,
  url: string,
  text: Text = english,
  locale?: string,
): string {
  const { build, counts } = overview;
  // Slack shows *x* bold; pasted into Jira it would stay as stars
  const bold = (value: string) => (format === "slack" ? `*${value}*` : value);
  const bullet = format === "slack" ? "• " : "* ";
  const title = text("report.textTitle", {
    project: build.projectName,
    number: build.number ?? "",
    branch: build.branchName ?? "",
  });
  const lines = [
    `${bold(title)} — ${text(`overview.verdict.${overview.verdict}` as MessageKey)}`,
    bullet +
      text("report.textCounts", {
        total: counts.total,
        devices: overview.devices.length,
        passed: counts.passed,
        changed: counts.changed,
        new: counts.new,
      }),
    bullet +
      text("report.textWaiting", {
        waiting: counts.waiting,
        rejected: counts.rejected,
      }),
  ];
  if (counts.a11yNew) {
    lines.push(bullet + text("report.textA11y", { count: counts.a11yNew }));
  }
  if (overview.bugs.length) {
    lines.push(
      bullet +
        text("report.textBugs", {
          keys: overview.bugs.map((bug) => bug.jiraKey).join(", "),
        }),
    );
  }
  lines.push(
    format === "slack" ? `<${url}|${text("report.textOpen")}>` : url,
    text("report.textAsOf", { time: time(overview.asOf, locale) }),
  );
  return lines.join("\n");
}
