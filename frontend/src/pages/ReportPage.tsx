import React from "react";
import { Box, Button, Typography } from "@mui/material";
import { DownloadRounded, LinkOffRounded } from "@mui/icons-material";
import { useLocation, useParams } from "react-router-dom";
import { tokens } from "../theme";
import { BrandMark } from "../components/BrandMark";
import {
  ReportDocument,
  textIn,
} from "../components/BuildReport/ReportDocument";
import { reportsService } from "../services";
import {
  ALL_SECTIONS,
  PublicReport,
  ReportSection,
} from "../types/buildOverview";
import { formatDate, Language } from "../i18n/translate";

// the open page asks again this often, so a decision shows within 10 s (REQ-031-63)
export const PUBLIC_REFRESH_MS = 8000;

const Bare: React.FunctionComponent<{ children: React.ReactNode }> = ({
  children,
}) => (
  <Box
    sx={{
      minHeight: "100%",
      bgcolor: tokens.lightbox,
      py: 3.5,
      px: 2,
      display: "flex",
      flexDirection: "column",
      gap: 1.75,
      "@media print": { bgcolor: "transparent", p: 0 },
      "@page": { size: "A4", margin: "14mm" },
    }}
  >
    {children}
  </Box>
);

const Gone: React.FunctionComponent<{ title: string; hint: string }> = ({
  title,
  hint,
}) => (
  <Box
    data-testid="reportUnavailable"
    sx={{
      maxWidth: 420,
      mx: "auto",
      mt: 10,
      textAlign: "center",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 1.25,
    }}
  >
    <LinkOffRounded sx={{ fontSize: 32, color: tokens.textMuted }} />
    <Typography component="h1" sx={{ fontSize: 18, fontWeight: 650 }}>
      {title}
    </Typography>
    <Typography sx={{ color: tokens.textSecondary }}>{hint}</Typography>
  </Box>
);

/** A report by its public link, without signing in (REQ-031-62…65). */
export const PublicReportPage: React.FunctionComponent = () => {
  const { token = "" } = useParams<{ token: string }>();
  const [report, setReport] = React.useState<PublicReport | null>(null);
  const [checkedAt, setCheckedAt] = React.useState<Date | null>(null);
  const etag = React.useRef<string>();

  React.useEffect(() => {
    let cancelled = false;
    const load = () =>
      reportsService
        .getPublic(token, etag.current)
        .then((answer) => {
          if (cancelled) return;
          setCheckedAt(new Date());
          if (!answer) return;
          etag.current = answer.etag;
          setReport(answer.report);
        })
        .catch(() => undefined);
    load();
    const timer = setInterval(load, PUBLIC_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [token]);

  if (!report) return <Bare>{null}</Bare>;
  const language: Language = report.language ?? "en";
  const t = textIn(language);
  if (report.state !== "ok") {
    return (
      <Bare>
        {report.state === "gone" ? (
          <Gone title={t("report.gone")} hint={t("report.goneHint")} />
        ) : (
          <Gone title={t("report.expired")} hint={t("report.expiredHint")} />
        )}
      </Bare>
    );
  }
  return (
    <Bare>
      <Box
        sx={{
          maxWidth: 880,
          width: "100%",
          mx: "auto",
          display: "flex",
          alignItems: "center",
          gap: 1.25,
          "@media print": { display: "none" },
        }}
      >
        <BrandMark size={26} />
        <Box sx={{ flex: 1 }} />
        <Box
          data-testid="reportLive"
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 0.75,
            fontSize: 12,
            color: tokens.textSecondary,
          }}
        >
          <Box
            sx={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              bgcolor: tokens.status.passed.bar,
            }}
          />
          {t("report.live")}
          {checkedAt &&
            ` · ${t("report.updated", {
              time: formatDate(checkedAt, language, {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              }),
            })}`}
        </Box>
        <Button
          size="small"
          variant="outlined"
          startIcon={<DownloadRounded />}
          onClick={() => window.print()}
        >
          {t("report.pdf")}
        </Button>
      </Box>
      <ReportDocument
        report={report}
        sections={report.sections ?? ALL_SECTIONS}
        language={language}
        wide
      />
    </Bare>
  );
};

/** The report of a build for someone signed in, opened to print it as a PDF (REQ-031-46). */
export const PrintReportPage: React.FunctionComponent = () => {
  const { buildId = "" } = useParams<{ buildId: string }>();
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const sections = (query.get("sections") ?? "")
    .split(",")
    .filter((section): section is ReportSection =>
      (ALL_SECTIONS as string[]).includes(section),
    );
  const language: Language = query.get("lang") === "uk" ? "uk" : "en";
  const [report, setReport] = React.useState<PublicReport | null>(null);

  React.useEffect(() => {
    reportsService
      .get(buildId)
      .then(setReport)
      .catch(() => undefined);
  }, [buildId]);

  // print once the pictures are in, or they come out blank on paper
  React.useEffect(() => {
    if (!report) return;
    const images = Array.from(document.images);
    Promise.all(
      images.map((image) =>
        image.complete
          ? null
          : new Promise((done) => {
              image.onload = done;
              image.onerror = done;
            }),
      ),
    ).then(() => window.print());
  }, [report]);

  return (
    <Bare>
      {report && (
        <ReportDocument
          report={report}
          sections={sections.length ? sections : ALL_SECTIONS}
          language={language}
          wide
        />
      )}
    </Bare>
  );
};
