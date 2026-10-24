import React from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link,
  Skeleton,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { useSnackbar } from "notistack";
import { v4 as uuid } from "uuid";
import { useProjectState, useUserState } from "../../contexts";
import { insightsService, testRunService } from "../../services";
import {
  A11yReport,
  A11yViolation,
  StructureInfo,
  TestRun,
  hasUiTree,
} from "../../types";
import { StatusPill } from "../StatusPill";
import { describeChange } from "../ChangeGroups";
import { tokens } from "../../theme";

type JiraDialog = { mode: "file" | "link"; violation: A11yViolation } | null;

const JIRA_KEY = /^[A-Za-z][A-Za-z0-9_]*-\d+$/;
const shortId = (resourceId: string) => resourceId.replace(/^.*:id\//, "id/");

const SEVERITY_COLOR: Record<A11yViolation["severity"], string> = {
  error: tokens.status.failed.fg,
  warning: tokens.status.changed.fg,
  info: tokens.textMuted,
};

interface Props {
  testRun: TestRun;
  report: A11yReport | null | undefined;
  onReportChanged: () => void;
  highlightedId?: string;
  onHighlight: (violation: A11yViolation) => void;
  aiEnabled: boolean;
}

/**
 * Side panel of the review: accessibility issues of the screenshot with their
 * Jira state, and what changed at the element level.
 */
export const InsightsPanel: React.FunctionComponent<Props> = ({
  testRun,
  report,
  onReportChanged,
  highlightedId,
  onHighlight,
  aiEnabled,
}) => {
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useUserState();
  const { projectList, selectedProjectId } = useProjectState();
  const project = projectList.find((p) => p.id === selectedProjectId);
  const jiraReady = !!project?.jiraUrl && !!project?.jiraTokenSet;
  const canEdit = user?.role === "admin" || user?.role === "editor";
  const withUiTree = hasUiTree(testRun);

  const [tab, setTab] = React.useState<"a11y" | "changes">(
    withUiTree ? "a11y" : "changes",
  );
  const [structure, setStructure] = React.useState<
    StructureInfo | null | undefined
  >();
  const [labels, setLabels] = React.useState<Record<string, string>>({});
  const [labelsLoading, setLabelsLoading] = React.useState(false);
  const [jiraDialog, setJiraDialog] = React.useState<JiraDialog>(null);
  const [jiraKey, setJiraKey] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [ignoreFor, setIgnoreFor] = React.useState<A11yViolation | null>(null);
  const [ignoreComment, setIgnoreComment] = React.useState("");

  React.useEffect(() => {
    setStructure(undefined);
    setLabels({});
    insightsService
      .getStructure(testRun.id)
      .then(setStructure)
      .catch(() => setStructure(null));
  }, [testRun.id, testRun.diffName]);

  React.useEffect(() => {
    setTab(withUiTree ? "a11y" : "changes");
  }, [withUiTree, testRun.id]);

  const run = async (action: () => Promise<unknown>, done: string) => {
    setSubmitting(true);
    try {
      await action();
      enqueueSnackbar(done, { variant: "success" });
      onReportChanged();
      return true;
    } catch (error) {
      enqueueSnackbar(`${error}`, { variant: "error" });
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const submitJira = async () => {
    if (!jiraDialog) return;
    const key = jiraKey.trim();
    if (jiraDialog.mode === "file") {
      setSubmitting(true);
      try {
        const result = await insightsService.fileA11yBug(
          testRun.id,
          jiraDialog.violation.id,
          key,
        );
        enqueueSnackbar(`Filed ${result.jiraKey}`, { variant: "success" });
        result.warnings.forEach((warning) =>
          enqueueSnackbar(warning, { variant: "warning" }),
        );
        onReportChanged();
        setJiraDialog(null);
      } catch (error) {
        enqueueSnackbar(`${error}`, { variant: "error" });
      } finally {
        setSubmitting(false);
      }
    } else if (
      await run(
        () =>
          insightsService.linkA11y(testRun.id, jiraDialog.violation.id, key),
        `Linked ${key.toUpperCase()}`,
      )
    ) {
      setJiraDialog(null);
    }
  };

  const suggestLabels = async () => {
    setLabelsLoading(true);
    try {
      const { suggestions } = await insightsService.suggestLabels(testRun.id);
      setLabels(
        Object.fromEntries(suggestions.map((s) => [s.violationId, s.label])),
      );
      if (!suggestions.length)
        enqueueSnackbar("No suggestions", { variant: "info" });
    } catch (error) {
      enqueueSnackbar(`${error}`, { variant: "error" });
    } finally {
      setLabelsLoading(false);
    }
  };

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text).then(
      () => enqueueSnackbar("Copied", { variant: "success" }),
      () => enqueueSnackbar(text, { variant: "info" }),
    );
  };

  const addIgnoreArea = (area: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) =>
    run(
      () =>
        testRunService.addIgnoreAreas({
          ids: [testRun.id],
          ignoreAreas: [{ id: uuid(), ...area }],
        }),
      "Ignore area added; the screenshot is compared again",
    );

  const violationCard = (violation: A11yViolation, index: number) => {
    const highlighted = violation.id === highlightedId;
    const reported = violation.issue?.status === "reported";
    const isNew = violation.status === "new" && !reported;
    return (
      <Box
        key={violation.id}
        component="article"
        onClick={() => onHighlight(violation)}
        sx={{
          cursor: "pointer",
          border: `1px solid ${isNew ? "#FEDF89" : tokens.border}`,
          bgcolor: isNew ? "#FFFCF5" : tokens.surface,
          outline: highlighted ? `2px solid ${tokens.a11y}` : "none",
          borderRadius: 2.5,
          p: 1.5,
          display: "flex",
          flexDirection: "column",
          gap: 0.75,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Box
            sx={{
              width: 20,
              height: 20,
              borderRadius: "50%",
              flexShrink: 0,
              bgcolor: isNew ? tokens.a11y : tokens.a11yExisting,
              color: "#fff",
              font: "600 11px/20px Inter, sans-serif",
              textAlign: "center",
            }}
          >
            {index + 1}
          </Box>
          <Typography
            sx={{ fontWeight: 600, fontSize: 14, flex: 1, minWidth: 0 }}
          >
            {violation.title}
          </Typography>
          <Typography
            sx={{
              fontSize: 11,
              fontWeight: 600,
              color: SEVERITY_COLOR[violation.severity],
            }}
          >
            {violation.severity.toUpperCase()}
          </Typography>
        </Box>
        <Typography sx={{ fontSize: 13, color: tokens.textSecondary }}>
          {violation.message}
        </Typography>
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            gap: 0.75,
            alignItems: "center",
          }}
        >
          {!reported && (
            <StatusPill
              tone={isNew ? "changed" : "neutral"}
              label={violation.status === "new" ? "New" : "Existing"}
            />
          )}
          {violation.resourceId && (
            <Box
              component="code"
              sx={{
                font: `500 12px ${tokens.mono}`,
                bgcolor: tokens.subtle,
                px: 0.75,
                borderRadius: 1,
              }}
            >
              {shortId(violation.resourceId)}
            </Box>
          )}
          {reported && (
            <StatusPill
              tone="passed"
              label={
                violation.issue?.jiraUrl ? (
                  <Link
                    href={violation.issue.jiraUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    color="inherit"
                  >
                    Bug {violation.issue.jiraKey}
                  </Link>
                ) : (
                  `Bug ${violation.issue?.jiraKey}`
                )
              }
            />
          )}
        </Box>
        {labels[violation.id] && (
          <Box
            sx={{
              display: "flex",
              gap: 1,
              alignItems: "center",
              fontSize: 13,
              bgcolor: tokens.surface,
              border: `1px solid ${tokens.border}`,
              borderRadius: 2,
              px: 1,
              py: 0.5,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <Box
              component="span"
              sx={{
                font: `600 10.5px ${tokens.mono}`,
                color: tokens.brand,
                border: `1px solid ${tokens.brand}`,
                borderRadius: "4px",
                px: 0.5,
              }}
            >
              AI
            </Box>
            <span>
              Suggested{" "}
              {report?.format === "appium-ios"
                ? "accessibilityLabel"
                : "contentDescription"}
              : <b>“{labels[violation.id]}”</b>
            </span>
            <Button
              size="small"
              sx={{ ml: "auto" }}
              onClick={() => copy(labels[violation.id])}
            >
              Copy
            </Button>
          </Box>
        )}
        {canEdit && (
          <Box
            sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}
            onClick={(e) => e.stopPropagation()}
          >
            {reported ? (
              <Button
                size="small"
                onClick={() =>
                  run(
                    () => insightsService.resetA11y(testRun.id, violation.id),
                    "Unlinked",
                  )
                }
              >
                Unlink bug
              </Button>
            ) : (
              <>
                {jiraReady && (
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      setJiraKey("");
                      setJiraDialog({ mode: "file", violation });
                    }}
                  >
                    Create Jira bug
                  </Button>
                )}
                <Button
                  size="small"
                  onClick={() => {
                    setJiraKey("");
                    setJiraDialog({ mode: "link", violation });
                  }}
                >
                  Link existing
                </Button>
                <Button
                  size="small"
                  sx={{ color: tokens.textSecondary }}
                  onClick={() => {
                    setIgnoreComment("");
                    setIgnoreFor(violation);
                  }}
                >
                  False positive
                </Button>
              </>
            )}
          </Box>
        )}
      </Box>
    );
  };

  const a11yTab = () => {
    if (!withUiTree) {
      return (
        <Typography variant="body2" color="textSecondary">
          No UI tree came with this screenshot. Send the Appium page source with
          it (for example <code>vrt.trackDriver(driver, name)</code> in the Java
          SDK) to check accessibility.
        </Typography>
      );
    }
    if (report === undefined)
      return <Skeleton variant="rounded" height={160} />;
    if (report === null) {
      return (
        <Typography variant="body2" color="textSecondary">
          The UI tree could not be checked.
        </Typography>
      );
    }
    const missingLabels = report.violations.some(
      (v) => v.rule === "missing-label",
    );
    return (
      <>
        <Typography variant="body2" color="textSecondary">
          Checked from the {report.format === "appium-ios" ? "iOS" : "Android"}{" "}
          UI tree.{" "}
          {report.baselineChecked ? (
            <>
              Compared with the baseline:{" "}
              <b style={{ color: tokens.text }}>{report.summary.new} new</b>,{" "}
              {report.summary.existing} existing, {report.summary.fixed} fixed
              {report.summary.reported
                ? `, ${report.summary.reported} with a bug`
                : ""}
              .
            </>
          ) : (
            "The baseline has no UI tree, so every issue counts as new."
          )}
          {report.pixelsPerDpEstimated &&
            " Sizes are estimated: the client sent no screen density."}
        </Typography>
        {!jiraReady && canEdit && (
          <Alert severity="info" sx={{ py: 0 }}>
            Add the Jira URL and token in project settings to file bugs from
            here.
          </Alert>
        )}
        {report.resolved.map((item) => (
          <Alert key={item.violationId} severity="success" sx={{ py: 0 }}>
            {item.jiraUrl ? (
              <Link href={item.jiraUrl} target="_blank" rel="noreferrer">
                {item.jiraKey}
              </Link>
            ) : (
              item.jiraKey
            )}{" "}
            is no longer found on this screen. The bug can probably be closed.
          </Alert>
        ))}
        {aiEnabled && missingLabels && canEdit && (
          <Button
            size="small"
            variant="outlined"
            disabled={labelsLoading}
            onClick={suggestLabels}
            sx={{ alignSelf: "flex-start" }}
          >
            {labelsLoading ? "Asking AI…" : "Suggest labels with AI"}
          </Button>
        )}
        {report.violations.length === 0 && (
          <Typography variant="body2">
            No accessibility issues found on this screen.
          </Typography>
        )}
        {report.violations.map(violationCard)}
        {report.ignored.length > 0 && (
          <Box
            component="details"
            sx={{
              borderTop: `1px solid ${tokens.border}`,
              pt: 1,
              fontSize: 13,
            }}
          >
            <summary style={{ cursor: "pointer", fontWeight: 500 }}>
              False positives ({report.ignored.length})
            </summary>
            {report.ignored.map((violation) => (
              <Box
                key={violation.id}
                sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1 }}
              >
                <span style={{ flex: 1 }}>
                  {violation.title} ·{" "}
                  {violation.label ||
                    shortId(violation.resourceId) ||
                    violation.className}
                  {violation.issue?.comment
                    ? ` — ${violation.issue.comment}`
                    : ""}
                </span>
                {canEdit && (
                  <Button
                    size="small"
                    onClick={() =>
                      run(
                        () =>
                          insightsService.resetA11y(testRun.id, violation.id),
                        "Restored",
                      )
                    }
                  >
                    Restore
                  </Button>
                )}
              </Box>
            ))}
          </Box>
        )}
      </>
    );
  };

  const changesTab = () => {
    if (structure === undefined)
      return <Skeleton variant="rounded" height={120} />;
    if (
      !structure ||
      (!structure.changes.length &&
        !structure.regions.length &&
        !structure.hints.length)
    ) {
      return (
        <Typography variant="body2" color="textSecondary">
          {testRun.diffName
            ? "No details about this change."
            : "Nothing changed against the baseline."}
        </Typography>
      );
    }
    return (
      <>
        {structure.hints.map((hint) => (
          <Alert
            key={hint.kind}
            severity="info"
            sx={{ py: 0 }}
            action={
              hint.ignoreArea && canEdit ? (
                <Button
                  size="small"
                  onClick={() => addIgnoreArea(hint.ignoreArea!)}
                >
                  Ignore area
                </Button>
              ) : undefined
            }
          >
            {hint.message}
          </Alert>
        ))}
        {structure.changes.length > 0 && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
            <Typography variant="subtitle2">From the UI tree</Typography>
            {structure.changes.map((change) => (
              <Typography key={`${change.kind}:${change.key}`} variant="body2">
                {describeChange(change)}
              </Typography>
            ))}
          </Box>
        )}
        {structure.regions.length > 0 && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
            <Typography variant="subtitle2">Changed areas</Typography>
            {structure.regions.map((area, index) => (
              <Typography
                key={index}
                variant="body2"
                color={area.element ? "textPrimary" : "textSecondary"}
              >
                {index + 1}.{" "}
                {area.element ??
                  `${area.region.width} × ${area.region.height} px at ${area.region.x}, ${area.region.y}`}
              </Typography>
            ))}
          </Box>
        )}
      </>
    );
  };

  const newCount = report?.summary.new ?? testRun.a11yNewCount ?? 0;

  return (
    <Box
      component="aside"
      aria-label="Review details"
      sx={{
        width: 380,
        flexShrink: 0,
        borderLeft: `1px solid ${tokens.border}`,
        bgcolor: tokens.surface,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      <Tabs
        value={tab}
        onChange={(_, value) => setTab(value)}
        sx={{ px: 2, borderBottom: `1px solid ${tokens.border}` }}
      >
        <Tab
          value="a11y"
          label={
            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              Accessibility{" "}
              {newCount > 0 && (
                <StatusPill tone="changed" label={`${newCount} new`} />
              )}
            </Box>
          }
        />
        <Tab value="changes" label="Changes" />
      </Tabs>
      <Box
        sx={{
          flex: 1,
          overflow: "auto",
          p: 2,
          display: "flex",
          flexDirection: "column",
          gap: 1.5,
        }}
      >
        {tab === "a11y" ? a11yTab() : changesTab()}
      </Box>

      <Dialog
        open={!!jiraDialog}
        onClose={() => setJiraDialog(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>
          {jiraDialog?.mode === "file"
            ? "Create Jira bug"
            : "Link an existing Jira issue"}
        </DialogTitle>
        <DialogContent
          sx={{ display: "flex", flexDirection: "column", gap: 2 }}
        >
          <Typography variant="body2" color="textSecondary">
            {jiraDialog?.mode === "file"
              ? "The bug goes into the project of this task and is linked to it. Screen, device, element and the screenshot with the element outlined are filled in."
              : "The issue will be shown on this problem on every later build."}
          </Typography>
          <TextField
            id="jira-key"
            autoFocus
            label={
              jiraDialog?.mode === "file"
                ? "Task to link the bug to"
                : "Jira issue"
            }
            placeholder="MOB-1234"
            value={jiraKey}
            onChange={(e) => setJiraKey(e.target.value)}
            error={!!jiraKey && !JIRA_KEY.test(jiraKey.trim())}
            helperText={
              jiraKey && !JIRA_KEY.test(jiraKey.trim())
                ? "Looks like ABC-123"
                : " "
            }
            onKeyDown={(e) => {
              if (e.key === "Enter" && JIRA_KEY.test(jiraKey.trim()))
                submitJira();
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setJiraDialog(null)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={submitting || !JIRA_KEY.test(jiraKey.trim())}
            onClick={submitJira}
          >
            {jiraDialog?.mode === "file"
              ? submitting
                ? "Creating…"
                : "Create bug"
              : "Link"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={!!ignoreFor}
        onClose={() => setIgnoreFor(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Mark as false positive</DialogTitle>
        <DialogContent
          sx={{ display: "flex", flexDirection: "column", gap: 2 }}
        >
          <Typography variant="body2" color="textSecondary">
            This issue stops counting on this screen in every later build and
            device. You can restore it from the list of false positives.
          </Typography>
          <TextField
            id="ignore-comment"
            label="Why (optional)"
            value={ignoreComment}
            onChange={(e) => setIgnoreComment(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIgnoreFor(null)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={submitting}
            onClick={async () => {
              if (
                ignoreFor &&
                (await run(
                  () =>
                    insightsService.ignoreA11y(
                      testRun.id,
                      ignoreFor.id,
                      ignoreComment || undefined,
                    ),
                  "Marked as false positive",
                ))
              ) {
                setIgnoreFor(null);
              }
            }}
          >
            Mark as false positive
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
