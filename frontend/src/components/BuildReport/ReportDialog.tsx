import React from "react";
import {
  Box,
  Button,
  Dialog,
  IconButton,
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
import { useUserState } from "../../contexts";
import { reportsService } from "../../services";
import {
  ALL_SECTIONS,
  BuildOverview,
  PublicReport,
  ReportLink,
  ReportSection,
} from "../../types/buildOverview";
import { reportText } from "../../_helpers/reportText.helper";
import { ReportDocument, textIn } from "./ReportDocument";
import { localeOf, Language } from "../../i18n/translate";

export const publicReportUrl = (token: string) =>
  `${window.location.origin}/r/${encodeURIComponent(token)}`;

export const printReportUrl = (
  buildId: string,
  sections: ReportSection[],
  language: Language,
) =>
  `${window.location.origin}/report/${buildId}?sections=${sections.join(",")}&lang=${language}`;

/**
 * A build's report (031): the whole report as readers will see it, and the
 * ways to share it. Nothing to set up: every section, in the interface's
 * language. Vision only copies and prints; it sends nothing anywhere
 * itself (REQ-031-49).
 */
export const ReportDialog: React.FunctionComponent<{
  open: boolean;
  buildId: string;
  overview: BuildOverview;
  onClose: () => void;
}> = ({ open, buildId, overview, onClose }) => {
  const { t, language, formatDate } = useT();
  const { user } = useUserState();
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
      sections: ALL_SECTIONS,
      language,
    });
    setLinks((current) => [link, ...current]);
    await copy("link", publicReportUrl(link.token));
  };
  // the text carries the link when there is one; otherwise the build itself
  const latestLink = links[0];
  const textUrl = latestLink
    ? publicReportUrl(latestLink.token)
    : `${window.location.origin}/${overview.build.projectId}?buildId=${buildId}`;
  const copyText = (format: "slack" | "jira") =>
    copy(
      format,
      reportText(
        overview,
        format,
        textUrl,
        textIn(language),
        localeOf(language),
      ),
    );

  const label = (text: string, what: string) =>
    copied === what
      ? t("report.copied")
      : copied === "failed"
        ? t("report.copyFailed")
        : text;

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
          minHeight: 54,
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 1,
          px: 2.5,
          pr: 1.5,
          py: 1,
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
        <Tooltip title={canLink ? "" : t("report.editorsOnly")}>
          <span>
            <Button
              size="small"
              variant="contained"
              startIcon={<LinkRounded />}
              disabled={!canLink || !report}
              onClick={copyLink}
              data-testid="copyReportLink"
            >
              {label(t("report.copyLink"), "link")}
            </Button>
          </span>
        </Tooltip>
        <Button
          size="small"
          variant="outlined"
          startIcon={<TagRounded />}
          data-testid="copySlackText"
          onClick={() => copyText("slack")}
        >
          {label(t("report.slackText"), "slack")}
        </Button>
        <Button
          size="small"
          variant="outlined"
          startIcon={<ContentCopyRounded />}
          data-testid="copyJiraText"
          onClick={() => copyText("jira")}
        >
          {label(t("report.jiraComment"), "jira")}
        </Button>
        <Button
          size="small"
          variant="outlined"
          startIcon={<DownloadRounded />}
          data-testid="printReport"
          href={printReportUrl(buildId, ALL_SECTIONS, language)}
          target="_blank"
          rel="noreferrer"
        >
          {t("report.pdf")}
        </Button>
        <IconButton onClick={onClose} aria-label={t("common.cancel")}>
          <Close />
        </IconButton>
      </Box>
      {links.length > 0 && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 1,
            px: 2.5,
            py: 0.75,
            borderBottom: `1px solid ${tokens.border}`,
            fontSize: 12,
            color: tokens.textSecondary,
          }}
        >
          <span>{t("report.links")}:</span>
          {links.map((link) => (
            <Box
              key={link.id}
              data-testid="reportLink"
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.5,
                border: `1px solid ${tokens.border}`,
                borderRadius: 999,
                pl: 1.25,
                pr: 0.25,
                color: tokens.text,
              }}
            >
              {t("report.linkBy", {
                who: link.createdBy ?? t("overview.someone"),
                date: formatDate(link.createdAt, {
                  day: "numeric",
                  month: "numeric",
                }),
              })}
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
                  sx={{ minWidth: 0, py: 0 }}
                >
                  {t("report.revoke")}
                </Button>
              )}
            </Box>
          ))}
        </Box>
      )}
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          bgcolor: tokens.lightbox,
          p: 3,
        }}
      >
        {report && (
          <ReportDocument
            report={report}
            sections={ALL_SECTIONS}
            language={language}
            wide
          />
        )}
      </Box>
    </Dialog>
  );
};
