import React from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link,
  MenuItem,
  Skeleton,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { AdsClick } from "@mui/icons-material";
import { useSnackbar } from "notistack";
import { v4 as uuid } from "uuid";
import { useProjectState, useUserState } from "../../contexts";
import { insightsService, testRunService } from "../../services";
import {
  A11yReport,
  A11yViolation,
  PickableElement,
  StructureInfo,
  TestRun,
  hasUiTree,
} from "../../types";
import { StatusPill } from "../StatusPill";
import { describeChange } from "../ChangeGroups";
import { CrossDevicePanel } from "./CrossDevicePanel";
import { JiraBugDialog } from "./JiraBugDialog";
import { tokens } from "../../theme";

type JiraDialog = { mode: "link"; violationIds: string[] } | null;

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
  // element-level changes, rules and warnings, loaded by the dialog for the overlay too
  structure: StructureInfo | null | undefined;
  onStructureChanged: () => void;
  // picking an element on the screenshot, kept by the dialog that owns the image
  pickMode: boolean;
  onPickModeChange: (on: boolean) => void;
  pickedElement?: PickableElement;
  onPickedDone: () => void;
  // outlines an element chosen in the rule dialog on the screenshot
  onPreviewElement?: (element: PickableElement | undefined) => void;
  /** the box of what the pointer is over in the panel, outlined on the screenshot */
  onPreviewViolation?: (id: string | undefined) => void;
  onPreviewRegion?: (
    region: { x: number; y: number; width: number; height: number } | undefined,
  ) => void;
}

type RuleDraft = {
  selector: string;
  // what the selector was picked from, when picked on the screenshot
  element?: string;
  action: "ignore" | "tolerate";
  maxDiffPercent: number;
  scope: "screen" | "project";
};

const selectorFor = (resourceId: string | null) =>
  resourceId ? `id:${resourceId.replace(/^.*:id\//, "")}` : "";

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
  structure,
  onStructureChanged,
  pickMode,
  onPickModeChange,
  pickedElement,
  onPickedDone,
  onPreviewElement,
  onPreviewViolation,
  onPreviewRegion,
}) => {
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useUserState();
  const { projectList, selectedProjectId } = useProjectState();
  const project = projectList.find((p) => p.id === selectedProjectId);
  // a personal token, or the project's shared one
  const jiraReady =
    !!project?.jiraUrl && (!!user?.jiraTokenSet || !!project?.jiraTokenSet);
  const canEdit = user?.role === "admin" || user?.role === "editor";
  const withUiTree = hasUiTree(testRun);

  const [tab, setTab] = React.useState<"a11y" | "changes" | "devices">(
    withUiTree ? "a11y" : "changes",
  );
  const [ruleDraft, setRuleDraft] = React.useState<RuleDraft | null>(null);
  const [advancedSelector, setAdvancedSelector] = React.useState(false);
  const [labels, setLabels] = React.useState<Record<string, string>>({});
  const [labelsLoading, setLabelsLoading] = React.useState(false);
  const [jiraDialog, setJiraDialog] = React.useState<JiraDialog>(null);
  // problems to file Jira bugs for: one, or every open one of the screenshot
  const [bugFor, setBugFor] = React.useState<{
    problems: A11yViolation[][];
  } | null>(null);
  const [jiraKey, setJiraKey] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [ignoreFor, setIgnoreFor] = React.useState<string[] | null>(null);
  const [ignoreComment, setIgnoreComment] = React.useState("");

  React.useEffect(() => {
    setLabels({});
  }, [testRun.id]);

  // the tab stays when moving between devices of a check; without a UI tree only Changes has content
  React.useEffect(() => {
    if (!withUiTree) setTab("changes");
  }, [withUiTree, testRun.id]);

  const run = async (action: () => Promise<unknown>, done: string) => {
    setSubmitting(true);
    try {
      const result = (await action()) as { warnings?: string[] } | undefined;
      enqueueSnackbar(done, { variant: "success" });
      // what did not work out in Jira (labels) does not undo the decision
      result?.warnings?.forEach((warning) =>
        enqueueSnackbar(warning, { variant: "warning" }),
      );
      onReportChanged();
      return true;
    } catch (error) {
      enqueueSnackbar(`${error}`, { variant: "error" });
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  // one card per problem: the same rule on one component, in the same state;
  // the numbers are the ones drawn on the screenshot
  const { problems, numberOf } = React.useMemo(() => {
    const violations = report?.violations ?? [];
    const byKey = new Map<string, A11yViolation[]>();
    for (const violation of violations) {
      const state = violation.issue
        ? `${violation.issue.status}:${violation.issue.jiraKey ?? ""}`
        : "open";
      const key = `${violation.group}|${state}`;
      byKey.set(key, [...(byKey.get(key) ?? []), violation]);
    }
    return {
      problems: [...byKey.values()],
      numberOf: new Map(violations.map((v, index) => [v.id, index + 1])),
    };
  }, [report]);
  const toFile = problems.filter((problem) => !problem[0].issue);

  const submitJira = async () => {
    if (!jiraDialog) return;
    const key = jiraKey.trim();
    if (
      await run(
        () =>
          insightsService.linkA11y(testRun.id, jiraDialog.violationIds, key),
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

  const numberBadge = (number: number, isNew: boolean) => (
    <Box
      key={number}
      sx={{
        width: 20,
        height: 20,
        borderRadius: "50%",
        flexShrink: 0,
        bgcolor: isNew ? tokens.a11y : tokens.a11yExisting,
        // a number on an orange or grey dot reads in white in both themes
        color: "white",
        font: "600 11px/20px Inter, sans-serif",
        textAlign: "center",
      }}
    >
      {number}
    </Box>
  );

  const jiraLink = (
    key: string | null | undefined,
    url: string | null | undefined,
    prefix = "",
  ) =>
    url ? (
      <Link
        href={url}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
        color="inherit"
      >
        {prefix}
        {key}
      </Link>
    ) : (
      `${prefix}${key}`
    );

  const problemCard = (problem: A11yViolation[]) => {
    const [violation] = problem;
    const ids = problem.map((v) => v.id);
    const several = problem.length > 1;
    const highlighted = ids.includes(highlightedId ?? "");
    const reported = violation.issue?.status === "reported";
    const filing = violation.issue?.status === "filing";
    // decided on another screen: the problem is the component's, on every screen
    const elsewhere = violation.issue?.screenName
      ? violation.issue.screenTitle || violation.issue.screenName
      : null;
    const isNew = problem.some((v) => v.status === "new") && !violation.issue;
    const component = /\|c:([^|]+)\|/.exec(violation.group)?.[1];
    const numbers = problem.map((v) => numberOf.get(v.id) ?? 0);
    const suggested = problem.filter((v) => labels[v.id]);
    return (
      <Box
        key={ids.join(",")}
        component="article"
        data-testid="a11yProblem"
        onClick={() => onHighlight(violation)}
        onMouseEnter={() => onPreviewViolation?.(violation.id)}
        onMouseLeave={() => onPreviewViolation?.(undefined)}
        sx={{
          cursor: "pointer",
          border: `1px solid ${isNew ? tokens.a11y : tokens.border}`,
          bgcolor: isNew ? tokens.a11ySoft : tokens.surface,
          transition: "border-color 220ms, background-color 220ms",
          "&:hover": { borderColor: isNew ? tokens.a11y : tokens.borderStrong },
          outline: highlighted ? `2px solid ${tokens.a11y}` : "none",
          borderRadius: 2.5,
          p: 1.5,
          display: "flex",
          flexDirection: "column",
          gap: 0.75,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Box sx={{ display: "flex", gap: 0.25, flexShrink: 0 }}>
            {numbers.slice(0, 3).map((number) => numberBadge(number, isNew))}
            {numbers.length > 3 && (
              <Typography
                component="span"
                sx={{ fontSize: 11, color: tokens.textSecondary, ml: 0.25 }}
              >
                +{numbers.length - 3}
              </Typography>
            )}
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
        {several ? (
          <>
            <Typography sx={{ fontSize: 13, color: tokens.textSecondary }}>
              The same issue on {problem.length} elements of{" "}
              <Box component="code" sx={{ font: `500 12px ${tokens.mono}` }}>
                {component}
              </Box>
              : one problem, one bug.
            </Typography>
            <Box
              component="ol"
              sx={{ m: 0, pl: 0, listStyle: "none", display: "grid", gap: 0.5 }}
            >
              {problem.map((item) => (
                <Box
                  component="li"
                  key={item.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onHighlight(item);
                  }}
                  sx={{
                    display: "flex",
                    gap: 0.75,
                    alignItems: "baseline",
                    fontSize: 12.5,
                    color: tokens.textSecondary,
                    borderRadius: 1,
                    px: 0.5,
                    bgcolor:
                      item.id === highlightedId ? tokens.subtle : "transparent",
                    "&:hover": { bgcolor: tokens.subtle },
                  }}
                >
                  <b style={{ color: tokens.text }}>{numberOf.get(item.id)}</b>
                  <span>{item.message}</span>
                </Box>
              ))}
            </Box>
          </>
        ) : (
          <Typography sx={{ fontSize: 13, color: tokens.textSecondary }}>
            {violation.message}
          </Typography>
        )}
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            gap: 0.75,
            alignItems: "center",
          }}
        >
          {!violation.issue && (
            <StatusPill
              tone={isNew ? "changed" : "neutral"}
              label={isNew ? "New" : "Existing"}
            />
          )}
          {!several && violation.resourceId && (
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
              label={jiraLink(
                violation.issue?.jiraKey,
                violation.issue?.jiraUrl,
                "Bug ",
              )}
            />
          )}
          {filing && (
            <StatusPill tone="changed" label="A bug is being filed…" />
          )}
          {violation.problemClass && (
            <StatusPill tone="neutral" label={violation.problemClass} />
          )}
          <Tooltip title="Problem id: in the Jira bug's summary and labels. Click to copy.">
            <Box
              component="code"
              data-testid="a11yProblemCode"
              onClick={(e) => {
                e.stopPropagation();
                copy(violation.problemCode);
              }}
              sx={{
                font: `500 11.5px ${tokens.mono}`,
                color: tokens.textSecondary,
                ml: "auto",
                cursor: "copy",
              }}
            >
              {violation.problemCode}
            </Box>
          </Tooltip>
        </Box>
        {elsewhere && (
          <Box
            data-testid="a11yElsewhere"
            sx={{
              fontSize: 13,
              bgcolor: tokens.subtle,
              border: `1px solid ${tokens.border}`,
              borderRadius: 2,
              px: 1,
              py: 0.5,
            }}
          >
            {component ? `A problem of ${component}: ` : ""}
            {violation.issue?.status === "ignored"
              ? "marked as a false positive"
              : violation.issue?.status === "filing"
                ? "a bug is being filed"
                : "filed"}{" "}
            on screen “{elsewhere}”. It holds here too; nothing to file.
          </Box>
        )}
        {!!violation.issue?.related?.length && (
          <Typography
            sx={{ fontSize: 12.5, color: tokens.textSecondary }}
            data-testid="a11yRelated"
          >
            Also filed for it:{" "}
            {violation.issue.related.map((item, index) => (
              <React.Fragment key={item.code}>
                {index ? ", " : ""}
                {jiraLink(item.jiraKey, item.jiraUrl)} ({item.code})
              </React.Fragment>
            ))}
          </Typography>
        )}
        {suggested.map((item) => (
          <Box
            key={item.id}
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
              {several && <b>{numberOf.get(item.id)}: </b>}
              Suggested{" "}
              {report?.format === "appium-ios"
                ? "accessibilityLabel"
                : "contentDescription"}
              : <b>“{labels[item.id]}”</b>
            </span>
            <Button
              size="small"
              sx={{ ml: "auto" }}
              onClick={() => copy(labels[item.id])}
            >
              Copy
            </Button>
          </Box>
        ))}
        {canEdit && (
          <Box
            sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}
            onClick={(e) => e.stopPropagation()}
          >
            {filing ? null : reported ? (
              <Button
                size="small"
                onClick={() =>
                  run(
                    () => insightsService.resetA11y(testRun.id, ids),
                    "Unlinked",
                  )
                }
              >
                {elsewhere ? "Unlink on every screen" : "Unlink bug"}
              </Button>
            ) : (
              <>
                {jiraReady && (
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => setBugFor({ problems: [problem] })}
                  >
                    Create Jira bug
                  </Button>
                )}
                <Button
                  size="small"
                  onClick={() => {
                    setJiraKey("");
                    setJiraDialog({ mode: "link", violationIds: ids });
                  }}
                >
                  Link existing
                </Button>
                <Button
                  size="small"
                  sx={{ color: tokens.textSecondary }}
                  onClick={() => {
                    setIgnoreComment("");
                    setIgnoreFor(ids);
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
          it (in the Java SDK:{" "}
          <code>TestRunOptions.builder().uiTree(driver.getPageSource())</code>),
          or check the screen with the Vision CLI, to check accessibility.
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
            {project?.jiraUrl
              ? "Add your Jira token in your profile to file bugs from here."
              : "Add the Jira URL in project settings to file bugs from here."}
          </Alert>
        )}
        {jiraReady && canEdit && toFile.length > 1 && (
          <Button
            size="small"
            variant="outlined"
            sx={{ alignSelf: "flex-start" }}
            onClick={() => setBugFor({ problems: toFile })}
            data-testid="fileAllBugs"
          >
            Create Jira bugs for all {toFile.length} open problems
          </Button>
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
        {problems.map(problemCard)}
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
                  {violation.issue?.screenName
                    ? ` (on screen “${violation.issue.screenTitle || violation.issue.screenName}”)`
                    : ""}
                </span>
                {canEdit && !violation.issue?.byClass && (
                  <Button
                    size="small"
                    onClick={() =>
                      run(
                        () =>
                          insightsService.resetA11y(testRun.id, [violation.id]),
                        "Restored",
                      )
                    }
                  >
                    {violation.issue?.screenName
                      ? "Restore on every screen"
                      : "Restore"}
                  </Button>
                )}
              </Box>
            ))}
          </Box>
        )}
      </>
    );
  };

  const openRule = (
    resourceId: string | null,
    action: RuleDraft["action"] = "ignore",
  ) =>
    setRuleDraft({
      selector: selectorFor(resourceId),
      action,
      maxDiffPercent: 5,
      scope: "screen",
    });

  // an element picked on the screenshot opens the rule dialog for it
  React.useEffect(() => {
    if (!pickedElement) return;
    setTab("changes");
    setRuleDraft({
      selector: pickedElement.selector,
      element: pickedElement.element,
      action: "ignore",
      maxDiffPercent: 5,
      scope: "screen",
    });
  }, [pickedElement]);
  const closeRule = () => {
    setRuleDraft(null);
    setAdvancedSelector(false);
    onPreviewElement?.(undefined);
    onPickedDone();
  };
  // elements of this screen a rule can name, once each
  const elementOptions = React.useMemo(() => {
    const seen = new Set<string>();
    return (structure?.elements ?? []).filter((item) => {
      if (seen.has(item.selector)) return false;
      seen.add(item.selector);
      return true;
    });
  }, [structure]);
  const chosenElement =
    elementOptions.find((item) => item.selector === ruleDraft?.selector) ??
    null;
  // the element the dialog was opened for (Ignore next to a change) is outlined too
  const ruleOpen = !!ruleDraft;
  React.useEffect(() => {
    if (ruleOpen && chosenElement) onPreviewElement?.(chosenElement);
  }, [ruleOpen, chosenElement, onPreviewElement]);

  const saveRule = async () => {
    if (!ruleDraft) return;
    const ok = await run(
      () =>
        insightsService.addElementRule(testRun.id, {
          scope: ruleDraft.scope,
          selector: ruleDraft.selector,
          action: ruleDraft.action,
          ...(ruleDraft.action === "tolerate"
            ? { maxDiffPercent: ruleDraft.maxDiffPercent }
            : {}),
        }),
      ruleDraft.scope === "project"
        ? "Rule added for every screen; the build is compared again"
        : "Rule added; the screenshot is compared again",
    );
    if (ok) {
      closeRule();
      onStructureChanged();
    }
  };

  const elementActions = (resourceId: string | null) =>
    canEdit && resourceId ? (
      <Box
        component="span"
        sx={{ display: "inline-flex", gap: 0.5, ml: "auto", flexShrink: 0 }}
      >
        <Button
          size="small"
          sx={{ minWidth: 0, px: 0.75 }}
          onClick={() => openRule(resourceId, "ignore")}
        >
          Ignore
        </Button>
        <Button
          size="small"
          sx={{ minWidth: 0, px: 0.75 }}
          onClick={() => openRule(resourceId, "tolerate")}
        >
          Tolerance
        </Button>
      </Box>
    ) : null;

  const changesTab = () => {
    if (structure === undefined)
      return <Skeleton variant="rounded" height={120} />;
    if (!structure) {
      return (
        <Typography variant="body2" color="textSecondary">
          No details about this change.
        </Typography>
      );
    }
    const visibleChanges = structure.changes.filter(
      (change) => change.kind !== "moved",
    );
    const nothing =
      !visibleChanges.length &&
      !structure.regions.length &&
      !structure.hints.length &&
      !structure.invisible.length &&
      !structure.warnings.length;
    return (
      <>
        {canEdit && withUiTree && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <Button
              size="small"
              variant={pickMode ? "contained" : "outlined"}
              startIcon={<AdsClick fontSize="small" />}
              sx={{ alignSelf: "flex-start" }}
              onClick={() => onPickModeChange(!pickMode)}
              data-testid="pickElement"
            >
              {pickMode ? "Cancel picking" : "Pick element on screenshot"}
            </Button>
            {pickMode && (
              <Typography variant="body2" color="textSecondary">
                Point at an element on the right image and click it to ignore it
                or allow small changes in it. Esc cancels.
              </Typography>
            )}
          </Box>
        )}
        {structure.warnings.map((warning) => (
          <Alert key={warning.kind} severity="warning" sx={{ py: 0 }}>
            {warning.message}
          </Alert>
        ))}
        {structure.invisible.length > 0 && (
          <Alert severity="error" sx={{ py: 0 }}>
            <b>Changes the screenshot does not show</b>
            {structure.invisible.map((change) => (
              <div key={`${change.kind}:${change.key}`}>
                {describeChange(change)}
              </div>
            ))}
          </Alert>
        )}
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
        {nothing && (
          <Typography variant="body2" color="textSecondary">
            {testRun.diffName
              ? "No details about this change."
              : "Nothing changed against the baseline."}
          </Typography>
        )}
        {structure.regions.length > 0 && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
            <Typography variant="subtitle2">Changed areas</Typography>
            {structure.regions.map((area, index) => (
              <Box
                key={index}
                data-testid="changedArea"
                onMouseEnter={() => onPreviewRegion?.(area.region)}
                onMouseLeave={() => onPreviewRegion?.(undefined)}
                sx={{
                  borderRadius: 1,
                  px: 0.5,
                  mx: -0.5,
                  "&:hover": { bgcolor: tokens.subtle },
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  fontSize: 14,
                }}
              >
                <span
                  style={{
                    color: area.element ? tokens.text : tokens.textSecondary,
                  }}
                >
                  {index + 1}.{" "}
                  {area.element ??
                    `${area.region.width} × ${area.region.height} px at ${area.region.x}, ${area.region.y}`}
                </span>
                {elementActions(area.resourceId)}
              </Box>
            ))}
          </Box>
        )}
        {visibleChanges.length > 0 && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
            <Typography variant="subtitle2">From the UI tree</Typography>
            {visibleChanges.map((change) => (
              <Box
                key={`${change.kind}:${change.key}`}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  fontSize: 14,
                }}
              >
                <span>{describeChange(change)}</span>
                {elementActions(change.resourceId || null)}
              </Box>
            ))}
          </Box>
        )}
        {structure.moves.length > 0 && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
            <Typography variant="subtitle2">
              Compared at their new place
            </Typography>
            <Typography variant="body2" color="textSecondary">
              These moved without changing, so the move alone is not counted:
            </Typography>
            {structure.moves.slice(0, 8).map((move) => (
              <Typography key={move.key} variant="body2">
                {move.element}:{" "}
                {move.dyDp
                  ? `${move.dyDp > 0 ? "down" : "up"} ${Math.abs(move.dyDp)} dp`
                  : ""}
                {move.dxDp && move.dyDp ? ", " : ""}
                {move.dxDp
                  ? `${move.dxDp > 0 ? "right" : "left"} ${Math.abs(move.dxDp)} dp`
                  : ""}
              </Typography>
            ))}
          </Box>
        )}
        {(structure.rules.length > 0 || structure.systemBars.length > 0) && (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 0.5,
              borderTop: `1px solid ${tokens.border}`,
              pt: 1.5,
            }}
          >
            <Typography variant="subtitle2">Rules for this screen</Typography>
            {structure.systemBars.length > 0 && (
              <Typography variant="body2" color="textSecondary">
                Status and navigation bars are left out (project setting).
              </Typography>
            )}
            {structure.rules.map((rule) => (
              <Box
                key={rule.id}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  fontSize: 13.5,
                }}
              >
                <StatusPill
                  tone="neutral"
                  label={
                    rule.scope === "project" ? "All screens" : "This screen"
                  }
                />
                <Box component="code" sx={{ font: `500 12px ${tokens.mono}` }}>
                  {rule.selector}
                </Box>
                <span style={{ color: tokens.textSecondary }}>
                  {rule.action === "ignore"
                    ? "ignored"
                    : `±${rule.maxDiffPercent}%`}{" "}
                  · {rule.matches} found
                </span>
                {canEdit && (
                  <Button
                    size="small"
                    sx={{ ml: "auto", minWidth: 0 }}
                    onClick={async () => {
                      if (
                        await run(
                          () =>
                            insightsService.removeElementRule(
                              testRun.id,
                              rule.scope,
                              rule.id,
                            ),
                          "Rule removed; compared again",
                        )
                      )
                        onStructureChanged();
                    }}
                  >
                    Remove
                  </Button>
                )}
              </Box>
            ))}
          </Box>
        )}
        {canEdit && withUiTree && (
          <Button
            size="small"
            sx={{ alignSelf: "flex-start" }}
            onClick={() => openRule(null)}
          >
            Add element rule
          </Button>
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
        <Tab
          value="changes"
          label={
            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              Changes
              {(structure?.warnings.length ?? 0) +
                (structure?.invisible.length ?? 0) >
                0 && (
                <StatusPill
                  tone="failed"
                  label={
                    (structure?.warnings.length ?? 0) +
                    (structure?.invisible.length ?? 0)
                  }
                />
              )}
            </Box>
          }
        />
        {withUiTree && <Tab value="devices" label="Devices" />}
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
        {tab === "a11y" ? (
          a11yTab()
        ) : tab === "devices" ? (
          <CrossDevicePanel testRun={testRun} />
        ) : (
          changesTab()
        )}
      </Box>

      <Dialog
        open={!!jiraDialog}
        onClose={() => setJiraDialog(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Link an existing Jira issue</DialogTitle>
        <DialogContent
          sx={{ display: "flex", flexDirection: "column", gap: 2 }}
        >
          <Typography variant="body2" color="textSecondary">
            The issue will be shown on this problem on every later build.
          </Typography>
          <TextField
            id="jira-key"
            label="Jira issue"
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
            Link
          </Button>
        </DialogActions>
      </Dialog>
      {bugFor && (
        <JiraBugDialog
          testRun={testRun}
          problems={bugFor.problems}
          onClose={() => setBugFor(null)}
          onDone={onReportChanged}
        />
      )}

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
                      ignoreFor,
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
      <Dialog open={!!ruleDraft} onClose={closeRule} fullWidth maxWidth="xs">
        <DialogTitle>
          {ruleDraft?.action === "tolerate"
            ? "Allow small changes"
            : "Ignore element"}
        </DialogTitle>
        <DialogContent
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            pt: "8px !important",
          }}
        >
          <Autocomplete
            id="rule-element"
            options={elementOptions}
            value={chosenElement}
            getOptionLabel={(item) => item.element}
            isOptionEqualToValue={(a, b) => a.selector === b.selector}
            onChange={(_, item) => {
              if (!ruleDraft) return;
              setRuleDraft({
                ...ruleDraft,
                selector: item?.selector ?? "",
                element: item?.element,
              });
              onPreviewElement?.(item ?? undefined);
            }}
            renderOption={(props, item) => (
              <li {...props} key={item.selector}>
                <Box>
                  <Typography variant="body2">{item.element}</Typography>
                  <Typography variant="caption" color="textSecondary">
                    {item.selector}
                  </Typography>
                </Box>
              </li>
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Element"
                placeholder="Type to search: Pay, balance, toolbar…"
                helperText={
                  chosenElement
                    ? `Found by ${chosenElement.selector.replace(/:.*/, "")}, outlined on the screenshot`
                    : !elementOptions.length
                      ? "This screenshot has no elements to choose from"
                      : " "
                }
              />
            )}
          />
          <Box sx={{ display: "flex", gap: 1, mt: -1.5 }}>
            <Button
              size="small"
              startIcon={<AdsClick fontSize="small" />}
              onClick={() => {
                const draft = ruleDraft;
                closeRule();
                if (draft) onPickModeChange(true);
              }}
            >
              Pick on the screenshot
            </Button>
            <Button
              size="small"
              sx={{ color: tokens.textSecondary, ml: "auto" }}
              onClick={() => setAdvancedSelector((value) => !value)}
            >
              {advancedSelector ? "Hide selector" : "Match differently"}
            </Button>
          </Box>
          {(advancedSelector || (!!ruleDraft?.selector && !chosenElement)) && (
            <TextField
              id="rule-selector"
              size="small"
              label="Selector"
              value={ruleDraft?.selector ?? ""}
              onChange={(e) =>
                ruleDraft &&
                setRuleDraft({
                  ...ruleDraft,
                  selector: e.target.value,
                  element: undefined,
                })
              }
              helperText="For a whole kind of element or a pattern: class:ImageButton, text:/\d+:\d+/ (any time), id:banner"
            />
          )}
          <TextField
            id="rule-action"
            select
            label="What to do"
            value={ruleDraft?.action ?? "ignore"}
            onChange={(e) =>
              ruleDraft &&
              setRuleDraft({
                ...ruleDraft,
                action: e.target.value as RuleDraft["action"],
              })
            }
          >
            <MenuItem value="ignore">Ignore it wherever it is</MenuItem>
            <MenuItem value="tolerate">Allow small changes inside it</MenuItem>
          </TextField>
          {ruleDraft?.action === "tolerate" && (
            <TextField
              id="rule-percent"
              type="number"
              label="Share of the element that may change, %"
              inputProps={{ min: 0, max: 100, step: 0.5 }}
              value={ruleDraft.maxDiffPercent}
              onChange={(e) =>
                setRuleDraft({
                  ...ruleDraft,
                  maxDiffPercent: Number(e.target.value),
                })
              }
            />
          )}
          <TextField
            id="rule-scope"
            select
            label="Where"
            value={ruleDraft?.scope ?? "screen"}
            onChange={(e) =>
              ruleDraft &&
              setRuleDraft({
                ...ruleDraft,
                scope: e.target.value as RuleDraft["scope"],
              })
            }
          >
            <MenuItem value="screen">This screen ({testRun.name})</MenuItem>
            <MenuItem value="project">Every screen of the project</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeRule}>Cancel</Button>
          <Button
            variant="contained"
            disabled={
              submitting ||
              !/^(id|class|text):.+/.test(ruleDraft?.selector.trim() ?? "")
            }
            onClick={saveRule}
          >
            Add rule
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
