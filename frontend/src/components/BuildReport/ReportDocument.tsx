import React from "react";
import { Box, Typography } from "@mui/material";
import { ArrowForward } from "@mui/icons-material";
import { tokens } from "../../theme";
import { BrandMark } from "../BrandMark";
import { StatusPill } from "../StatusPill";
import { ResultBar } from "../BuildOverview/ResultBar";
import { staticService } from "../../services";
import { DICTIONARIES, Text } from "../../i18n/dictionaries";
import type { MessageKey } from "../../i18n";
import { formatDate, Language, translate } from "../../i18n/translate";
import { PublicReport, ReportSection } from "../../types/buildOverview";
import { sincePrevious } from "../../_helpers/previousBuild.helper";

/** Texts in the report's own language, whatever the interface speaks (REQ-031-42). */
export const textIn =
  (language: Language): Text =>
  (key, params) =>
    translate(DICTIONARIES, language, key, params);

const Section: React.FunctionComponent<{
  id: ReportSection;
  title: string;
  children: React.ReactNode;
}> = ({ id, title, children }) => (
  <Box
    component="section"
    data-testid={`reportSection-${id}`}
    sx={{
      display: "flex",
      flexDirection: "column",
      gap: 1,
      breakInside: "avoid-page",
    }}
  >
    <Typography
      component="h5"
      sx={{
        fontFamily: tokens.mono,
        fontSize: 10.5,
        letterSpacing: "0.07em",
        textTransform: "uppercase",
        color: tokens.textSecondary,
      }}
    >
      {title}
    </Typography>
    {children}
  </Box>
);

const tableSx = {
  width: "100%",
  borderCollapse: "collapse" as const,
  fontSize: 12,
  "& th": {
    textAlign: "left",
    fontWeight: 600,
    fontSize: 10.5,
    color: tokens.textSecondary,
    p: "5px 6px",
    borderBottom: `1px solid ${tokens.borderStrong}`,
  },
  "& td": {
    p: "6px",
    borderBottom: `1px solid ${tokens.border}`,
    fontVariantNumeric: "tabular-nums",
  },
  "& .r": { textAlign: "right" },
};

const SHOT_SX = { width: 72, borderRadius: 1, flexShrink: 0 };

/** A screenshot of the report; one whose file is gone shows as an empty frame. */
const Shot: React.FunctionComponent<{ name: string | null; alt: string }> = ({
  name,
  alt,
}) => {
  const [broken, setBroken] = React.useState(false);
  if (!name) return null;
  return broken ? (
    <Box
      data-testid="reportShotMissing"
      role="img"
      aria-label={alt}
      sx={{
        ...SHOT_SX,
        height: 150,
        border: `1px dashed ${tokens.borderStrong}`,
        bgcolor: tokens.subtle,
      }}
    />
  ) : (
    <Box
      component="img"
      src={staticService.getImage(name)}
      alt={alt}
      loading="lazy"
      onError={() => setBroken(true)}
      sx={{
        ...SHOT_SX,
        maxHeight: 150,
        objectFit: "contain",
        boxShadow: tokens.shadowShot,
        bgcolor: tokens.surface,
      }}
    />
  );
};

/**
 * A build's report (031): the same sheet in the dialog's preview, on the
 * public page and on paper. Sections it is not given are left out.
 */
export const ReportDocument: React.FunctionComponent<{
  report: PublicReport;
  sections: ReportSection[];
  language: Language;
  wide?: boolean;
}> = ({ report, sections, language, wide }) => {
  const overview = report.overview;
  if (!overview) return null;
  const t = textIn(language);
  const has = (section: ReportSection) => sections.includes(section);
  const { build, counts } = overview;
  const kv: Array<[number, string, string?]> = [
    [counts.total, t("overview.screens")],
    [counts.waiting, t("overview.waiting"), tokens.status.changed.fg],
    [counts.rejected, t("overview.rejected"), tokens.status.failed.fg],
    [counts.a11yNew, t("overview.a11yNew"), tokens.a11y],
    [counts.bugs, t("overview.jiraBugs"), tokens.status.new.fg],
  ];
  return (
    <Box
      component="article"
      data-testid="reportDocument"
      lang={language}
      sx={{
        bgcolor: tokens.surface,
        color: tokens.text,
        borderRadius: 2.5,
        boxShadow: tokens.shadowShot,
        p: "26px 30px 22px",
        display: "flex",
        flexDirection: "column",
        gap: 2.25,
        maxWidth: wide ? 880 : 720,
        mx: "auto",
        "@media print": { boxShadow: "none", p: 0, maxWidth: "none" },
      }}
    >
      <Box
        component="header"
        sx={{
          display: "flex",
          gap: 1.75,
          alignItems: "flex-start",
          pb: 1.75,
          borderBottom: `2px solid ${tokens.text}`,
        }}
      >
        <BrandMark size={30} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            sx={{
              fontFamily: tokens.mono,
              fontSize: 10.5,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: tokens.textSecondary,
            }}
          >
            {t("report.buildReport")}
          </Typography>
          <Typography component="h2" sx={{ fontSize: 22, fontWeight: 650 }}>
            {t("report.textTitle", {
              project: build.projectName,
              number: build.number ?? "",
              branch: build.branchName ?? "",
            })}
          </Typography>
          <Typography sx={{ fontSize: 12, color: tokens.textSecondary }}>
            {[
              formatDate(build.createdAt, language, {
                day: "numeric",
                month: "numeric",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              }),
              overview.devices.length > 0 &&
                t("report.devices", { count: overview.devices.length }),
              build.ciBuildId,
            ]
              .filter(Boolean)
              .join(" · ")}
          </Typography>
        </Box>
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 0.5,
          }}
        >
          <StatusPill
            tone={
              overview.verdict === "passed"
                ? "passed"
                : overview.verdict === "reviewed"
                  ? "failed"
                  : "changed"
            }
            label={t(`overview.verdict.${overview.verdict}` as MessageKey)}
          />
          <Typography
            data-testid="reportAsOf"
            sx={{ fontSize: 11, color: tokens.textSecondary }}
          >
            {t("report.textAsOf", {
              time: formatDate(overview.asOf, language, {
                hour: "2-digit",
                minute: "2-digit",
                day: "numeric",
                month: "numeric",
              }),
            })}
          </Typography>
        </Box>
      </Box>

      {has("sum") && (
        <Section id="sum" title={t("report.section.sum")}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
              border: `1px solid ${tokens.border}`,
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            {kv.map(([value, label, color], i) => (
              <Box
                key={label}
                sx={{
                  px: 1.25,
                  py: 1,
                  borderLeft: i ? `1px solid ${tokens.border}` : 0,
                }}
              >
                <Typography
                  sx={{
                    fontSize: 19,
                    fontWeight: 650,
                    fontVariantNumeric: "tabular-nums",
                    color: value && color ? color : tokens.text,
                  }}
                >
                  {value}
                </Typography>
                <Typography sx={{ fontSize: 11, color: tokens.textSecondary }}>
                  {label}
                </Typography>
              </Box>
            ))}
          </Box>
          <Typography sx={{ fontSize: 12, color: tokens.textSecondary }}>
            {t("overview.decided")}: {overview.progress.decided} /{" "}
            {overview.progress.needed}
            {overview.previous && ` · ${sincePrevious(overview.previous, t)}`}
          </Typography>
        </Section>
      )}

      {has("chg") && (
        <Section id="chg" title={t("report.section.chg")}>
          {(report.changes ?? []).length === 0 ? (
            <Typography sx={{ fontSize: 12, color: tokens.textSecondary }}>
              {t("report.noChanges")}
            </Typography>
          ) : (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: 1.25,
              }}
            >
              {(report.changes ?? []).map((change) => (
                <Box
                  key={change.testRunId}
                  data-testid="reportChange"
                  sx={{
                    border: `1px solid ${tokens.border}`,
                    borderRadius: 2,
                    p: 1.25,
                    display: "flex",
                    flexDirection: "column",
                    gap: 1,
                    breakInside: "avoid",
                  }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      gap: 1,
                      alignItems: "center",
                      justifyContent: "center",
                      bgcolor: tokens.lightbox,
                      borderRadius: 1.5,
                      p: 1,
                    }}
                  >
                    <Shot
                      name={change.baselineName}
                      alt={t("report.baseline")}
                    />
                    <ArrowForward
                      sx={{ fontSize: 16, color: tokens.textSecondary }}
                    />
                    <Shot
                      name={change.diffName ?? change.imageName}
                      alt={t("report.checkpoint")}
                    />
                  </Box>
                  <Box sx={{ fontSize: 11.5 }}>
                    <StatusPill
                      tone={change.status === "failed" ? "failed" : "changed"}
                      label={t(
                        change.status === "failed"
                          ? "overview.rejected"
                          : "overview.waiting",
                      )}
                    />
                    <Typography sx={{ fontSize: 12, fontWeight: 600, mt: 0.5 }}>
                      {change.name}
                    </Typography>
                    <Typography
                      sx={{ fontSize: 11.5, color: tokens.textSecondary }}
                    >
                      {[change.device, change.os].filter(Boolean).join(" · ")}
                      {change.diffPercent !== null &&
                        ` · ${change.diffPercent.toFixed(2)}%`}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          )}
          {!!report.moreChanges && (
            <Typography sx={{ fontSize: 12, color: tokens.textSecondary }}>
              {t("report.moreChanges", { count: report.moreChanges })}
            </Typography>
          )}
        </Section>
      )}

      {has("bugs") && overview.bugs.length > 0 && (
        <Section id="bugs" title={t("report.section.bugs")}>
          <Box
            component="ul"
            sx={{ m: 0, p: 0, listStyle: "none", display: "grid", gap: 0.625 }}
          >
            {overview.bugs.map((bug) => (
              <Box
                component="li"
                key={bug.jiraKey}
                sx={{ display: "flex", gap: 1, fontSize: 12 }}
              >
                <Box
                  component={bug.jiraUrl ? "a" : "span"}
                  href={bug.jiraUrl ?? undefined}
                  target="_blank"
                  rel="noreferrer"
                  sx={{
                    fontFamily: tokens.mono,
                    fontWeight: 600,
                    color: tokens.status.new.fg,
                    whiteSpace: "nowrap",
                  }}
                >
                  {bug.jiraKey}
                </Box>
                <span>{bug.summary}</span>
                <span style={{ color: tokens.textSecondary }}>
                  · {t(bug.isNew ? "overview.bugNew" : "overview.bugKnown")}
                </span>
              </Box>
            ))}
          </Box>
        </Section>
      )}

      {has("dev") && overview.devices.length > 0 && (
        <Section id="dev" title={t("report.section.dev")}>
          <Box component="table" sx={tableSx}>
            <thead>
              <tr>
                <th>{t("overview.device")}</th>
                <th>{t("overview.result")}</th>
                <th className="r">{t("overview.review")}</th>
                <th className="r">{t("overview.a11y")}</th>
              </tr>
            </thead>
            <tbody>
              {overview.devices.map((row) => (
                <tr
                  key={[row.device, row.os, row.browser, row.viewport].join(
                    "|",
                  )}
                >
                  <td>
                    {row.device}{" "}
                    <span style={{ color: tokens.textSecondary }}>
                      {row.os}
                    </span>
                  </td>
                  <td style={{ width: 120 }}>
                    <ResultBar outcome={row} />
                  </td>
                  <td className="r">{row.changed + row.new}</td>
                  <td className="r">{row.a11yNew}</td>
                </tr>
              ))}
            </tbody>
          </Box>
        </Section>
      )}

      {has("feat") && overview.features.length > 0 && (
        <Section id="feat" title={t("report.section.feat")}>
          <Box component="table" sx={tableSx}>
            <thead>
              <tr>
                <th>{t("overview.feature")}</th>
                <th>{t("overview.result")}</th>
                <th className="r">{t("overview.review")}</th>
                <th className="r">{t("overview.bugs")}</th>
              </tr>
            </thead>
            <tbody>
              {overview.features.map((row) => (
                <tr key={row.name}>
                  <td>{row.name}</td>
                  <td style={{ width: 120 }}>
                    <ResultBar outcome={row} />
                  </td>
                  <td className="r">{row.changed + row.new}</td>
                  <td className="r">{row.bugs}</td>
                </tr>
              ))}
              {overview.quietFeatures.count > 0 && (
                <tr>
                  <td style={{ color: tokens.textSecondary }}>
                    {t("overview.quiet", {
                      count: overview.quietFeatures.count,
                    })}
                  </td>
                  <td />
                  <td />
                  <td />
                </tr>
              )}
            </tbody>
          </Box>
        </Section>
      )}

      {has("a11y") && (report.a11y ?? []).length > 0 && (
        <Section id="a11y" title={t("report.section.a11y")}>
          <Box component="table" sx={tableSx}>
            <thead>
              <tr>
                <th>{t("report.screen")}</th>
                <th>{t("overview.device")}</th>
                <th className="r">{t("report.newIssues")}</th>
              </tr>
            </thead>
            <tbody>
              {(report.a11y ?? []).map((row) => (
                <tr key={row.testRunId}>
                  <td>{row.name}</td>
                  <td>{row.device}</td>
                  <td className="r">{row.newCount}</td>
                </tr>
              ))}
            </tbody>
          </Box>
        </Section>
      )}

      <Box
        component="footer"
        sx={{
          display: "flex",
          justifyContent: "space-between",
          gap: 1.25,
          fontSize: 10.5,
          color: tokens.textSecondary,
          borderTop: `1px solid ${tokens.border}`,
          pt: 1.25,
          fontFamily: tokens.mono,
        }}
      >
        <span>Vision</span>
        {report.createdBy && (
          <span>{t("report.madeBy", { name: report.createdBy })}</span>
        )}
      </Box>
    </Box>
  );
};
