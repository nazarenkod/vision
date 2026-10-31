import React from "react";
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  FormControlLabel,
  IconButton,
  ToggleButton,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  Close,
  ContentCopyRounded,
  DownloadRounded,
  LinkRounded,
  TagRounded,
} from "@mui/icons-material";
import { tokens } from "../../theme";
import { useT } from "../../i18n";
import type { MessageKey } from "../../i18n";
import { useUserState } from "../../contexts";
import { reportsService } from "../../services";
import {
  ALL_SECTIONS,
  BuildOverview,
  PublicReport,
  ReportLink,
  ReportSection,
  SHORT_SECTIONS,
} from "../../types/buildOverview";
import { reportText } from "../../_helpers/reportText.helper";
import { ReportDocument, textIn } from "./ReportDocument";
import { SlidingToggleGroup } from "../motion/SlidingToggleGroup";
import { localeOf, Language } from "../../i18n/translate";

const DAYS = [7, 30, 90];

export const publicReportUrl = (token: string) =>
  `${window.location.origin}/r/${encodeURIComponent(token)}`;

export const printReportUrl = (
  buildId: string,
  sections: ReportSection[],
  language: Language,
) =>
  `${window.location.origin}/report/${buildId}?sections=${sections.join(",")}&lang=${language}`;

const Segmented: React.FunctionComponent<{
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  ariaLabel: string;
}> = ({ value, onChange, options, ariaLabel }) => (
  <SlidingToggleGroup
    exclusive
    size="small"
    value={value}
    aria-label={ariaLabel}
    onChange={(_event, next: string | null) => next && onChange(next)}
    sx={{ alignSelf: "flex-start" }}
  >
    {options.map((option) => (
      <ToggleButton
        key={option.value}
        value={option.value}
        data-testid={`segment-${option.value}`}
      >
        {option.label}
      </ToggleButton>
    ))}
  </SlidingToggleGroup>
);

const SideTitle: React.FunctionComponent<{ children: React.ReactNode }> = ({
  children,
}) => (
  <Typography
    sx={{
      fontFamily: tokens.mono,
      fontSize: 10.5,
      letterSpacing: "0.06em",
      textTransform: "uppercase",
      color: tokens.textSecondary,
      display: "flex",
      alignItems: "center",
      gap: 1,
      "&::after": {
        content: '""',
        flex: 1,
        height: "1px",
        bgcolor: tokens.border,
      },
    }}
  >
    {children}
  </Typography>
);

/**
 * A build's report (031): pick what goes in, see it, share it. Vision only
 * copies and prints; it sends nothing anywhere itself (REQ-031-49).
 */
export const ReportDialog: React.FunctionComponent<{
  open: boolean;
  buildId: string;
  overview: BuildOverview;
  onClose: () => void;
}> = ({ open, buildId, overview, onClose }) => {
  const { t, language: interfaceLanguage, formatDate } = useT();
  const { user } = useUserState();
  const [full, setFull] = React.useState(false);
  const [off, setOff] = React.useState<Set<ReportSection>>(new Set());
  const [language, setLanguage] = React.useState<Language>(interfaceLanguage);
  const [days, setDays] = React.useState(30);
  const [report, setReport] = React.useState<PublicReport | null>(null);
  const [links, setLinks] = React.useState<ReportLink[]>([]);
  const [copied, setCopied] = React.useState<string | null>(null);
  const canLink = user?.role === "admin" || user?.role === "editor";

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    reportsService
      .get(buildId)
      .then((result) => !cancelled && setReport(result))
      .catch(() => !cancelled && setReport(null));
    reportsService
      .links(buildId)
      .then((result) => !cancelled && setLinks(result))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // the preview follows the overview: a decision elsewhere shows up here too
  }, [open, buildId, overview.asOf]);

  const offered = full ? ALL_SECTIONS : SHORT_SECTIONS;
  const sections = offered.filter((section) => !off.has(section));

  const flash = (what: string) => {
    setCopied(what);
    setTimeout(
      () => setCopied((current) => (current === what ? null : current)),
      1600,
    );
  };
  const copy = async (what: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      flash(what);
    } catch {
      flash("failed");
    }
  };

  const copyLink = async () => {
    const link = await reportsService.createLink(buildId, {
      sections,
      language,
      days,
    });
    setLinks((current) => [link, ...current]);
    await copy("link", publicReportUrl(link.token));
  };
  // text and PDF carry the link too when there is one; otherwise the build itself
  const latestLink = links[0];
  const textUrl = latestLink
    ? publicReportUrl(latestLink.token)
    : `${window.location.origin}/${overview.build.projectId}?buildId=${buildId}`;

  const label = (key: string, what: string, Icon: typeof LinkRounded) => (
    <>
      <Icon sx={{ fontSize: 18 }} />
      <Box component="span" sx={{ flex: 1, textAlign: "left" }}>
        {copied === what
          ? t("report.copied")
          : copied === "failed"
            ? t("report.copyFailed")
            : key}
      </Box>
    </>
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="lg"
      PaperProps={{ sx: { height: "calc(100% - 64px)" } }}
      aria-labelledby="report-title"
    >
      <Box
        sx={{
          height: 54,
          display: "flex",
          alignItems: "center",
          gap: 1.25,
          px: 2.5,
          pr: 1.5,
          borderBottom: `1px solid ${tokens.border}`,
          flexShrink: 0,
        }}
      >
        <Typography
          id="report-title"
          component="h2"
          sx={{ fontSize: 16, fontWeight: 650 }}
        >
          {t("report.title")}
        </Typography>
        <Typography sx={{ fontSize: 12, color: tokens.textSecondary }}>
          {t("report.snapshot", {
            number: overview.build.number ?? "",
            time: formatDate(overview.asOf, {
              hour: "2-digit",
              minute: "2-digit",
            }),
          })}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <IconButton onClick={onClose} aria-label={t("common.cancel")}>
          <Close />
        </IconButton>
      </Box>
      <Box sx={{ flex: 1, display: "flex", minHeight: 0 }}>
        <Box
          sx={{
            width: 300,
            flexShrink: 0,
            borderRight: `1px solid ${tokens.border}`,
            p: 2,
            display: "flex",
            flexDirection: "column",
            gap: 1.75,
            overflow: "auto",
          }}
        >
          <Segmented
            value={full ? "full" : "short"}
            onChange={(next) => setFull(next === "full")}
            options={[
              { value: "short", label: t("report.short") },
              { value: "full", label: t("report.full") },
            ]}
            ariaLabel={t("report.sections")}
          />
          <SideTitle>{t("report.sections")}</SideTitle>
          <Box sx={{ display: "flex", flexDirection: "column" }}>
            {ALL_SECTIONS.map((section) => (
              <FormControlLabel
                key={section}
                disabled={!offered.includes(section)}
                control={
                  <Checkbox
                    size="small"
                    data-testid={`reportOption-${section}`}
                    checked={offered.includes(section) && !off.has(section)}
                    onChange={() =>
                      setOff((current) => {
                        const next = new Set(current);
                        if (next.has(section)) next.delete(section);
                        else next.add(section);
                        return next;
                      })
                    }
                  />
                }
                label={t(`report.section.${section}` as MessageKey)}
              />
            ))}
          </Box>
          <SideTitle>{t("report.language")}</SideTitle>
          <Segmented
            value={language}
            onChange={(next) => setLanguage(next as Language)}
            options={[
              { value: "en", label: "English" },
              { value: "uk", label: "Українська" },
            ]}
            ariaLabel={t("report.language")}
          />
          <SideTitle>{t("report.share")}</SideTitle>
          <Typography sx={{ fontSize: 12, color: tokens.textSecondary }}>
            {t("report.expiresIn")}
          </Typography>
          <Segmented
            value={String(days)}
            onChange={(next) => setDays(Number(next))}
            options={DAYS.map((value) => ({
              value: String(value),
              label: t("report.days", { count: value }),
            }))}
            ariaLabel={t("report.expiresIn")}
          />
          <Tooltip title={canLink ? "" : t("report.editorsOnly")}>
            <span>
              <Button
                fullWidth
                variant="contained"
                disabled={!canLink || !report}
                onClick={copyLink}
                data-testid="copyReportLink"
                sx={{ justifyContent: "flex-start", gap: 1 }}
              >
                {label(t("report.copyLink"), "link", LinkRounded)}
              </Button>
            </span>
          </Tooltip>
          <Button
            fullWidth
            variant="outlined"
            data-testid="copySlackText"
            onClick={() =>
              copy(
                "slack",
                reportText(
                  overview,
                  "slack",
                  textUrl,
                  textIn(language),
                  localeOf(language),
                ),
              )
            }
            sx={{ justifyContent: "flex-start", gap: 1 }}
          >
            {label(t("report.slackText"), "slack", TagRounded)}
          </Button>
          <Button
            fullWidth
            variant="outlined"
            data-testid="copyJiraText"
            onClick={() =>
              copy(
                "jira",
                reportText(
                  overview,
                  "jira",
                  textUrl,
                  textIn(language),
                  localeOf(language),
                ),
              )
            }
            sx={{ justifyContent: "flex-start", gap: 1 }}
          >
            {label(t("report.jiraComment"), "jira", ContentCopyRounded)}
          </Button>
          <Button
            fullWidth
            variant="outlined"
            data-testid="printReport"
            href={printReportUrl(buildId, sections, language)}
            target="_blank"
            rel="noreferrer"
            sx={{ justifyContent: "flex-start", gap: 1 }}
          >
            <DownloadRounded sx={{ fontSize: 18 }} />
            <Box component="span" sx={{ flex: 1, textAlign: "left" }}>
              {t("report.pdf")}
            </Box>
          </Button>
          <SideTitle>{t("report.links")}</SideTitle>
          {links.length === 0 && (
            <Typography sx={{ fontSize: 12, color: tokens.textSecondary }}>
              {t("report.noLinks")}
            </Typography>
          )}
          {links.map((link) => (
            <Box
              key={link.id}
              data-testid="reportLink"
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                border: `1px solid ${tokens.border}`,
                borderRadius: 2,
                px: 1,
                py: 0.75,
                fontSize: 12,
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                {t("report.linkUntil", {
                  date: formatDate(link.expiresAt, {
                    day: "numeric",
                    month: "numeric",
                  }),
                  who: link.createdBy ?? t("overview.someone"),
                })}
              </Box>
              {(user?.role === "admin" || link.createdById === user?.id) && (
                <Button
                  size="small"
                  onClick={() =>
                    reportsService
                      .revokeLink(link.id)
                      .then(() =>
                        setLinks((current) =>
                          current.filter((other) => other.id !== link.id),
                        ),
                      )
                  }
                >
                  {t("report.revoke")}
                </Button>
              )}
            </Box>
          ))}
        </Box>
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            overflow: "auto",
            bgcolor: tokens.lightbox,
            p: 3,
          }}
        >
          {report && (
            <ReportDocument
              report={report}
              sections={sections}
              language={language}
            />
          )}
        </Box>
      </Box>
    </Dialog>
  );
};
