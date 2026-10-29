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
  IconButton,
  FormControlLabel,
  Link,
  Menu,
  MenuItem,
  Skeleton,
  Switch,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  BugReport,
  MoreHoriz,
  VisibilityOffOutlined,
} from "@mui/icons-material";
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
  VisualBug,
  hasUiTree,
} from "../../types";
import { StatusPill } from "../StatusPill";
import { describeChange } from "../ChangeGroups";
import { JiraBugDialog } from "./JiraBugDialog";
import { tokens } from "../../theme";
import { labelOf, useT } from "../../i18n";
import { WhatsCompared } from "./WhatsCompared";
import { groupAreas, splitElement } from "./changedAreas";
import { IgnoreArea } from "../../types/ignoreArea";
import { SelectorMatches } from "../../types/insights";
import { elementLabel } from "../../_helpers/elementPicking.helper";

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
  // an element chosen on the screenshot for the full rule form (REQ-024-10)
  pickedElement?: PickableElement;
  onPickedDone: () => void;
  // outlines an element chosen in the rule dialog on the screenshot
  onPreviewElement?: (element: PickableElement | undefined) => void;
  /** the box of what the pointer is over in the panel, outlined on the screenshot */
  onPreviewViolation?: (id: string | undefined) => void;
  onPreviewRegion?: (
    region: { x: number; y: number; width: number; height: number } | undefined,
  ) => void;
  // a rule or an area the pointer is over, lit up on the screenshots (REQ-024-24)
  onPreviewMark?: (id: string | undefined) => void;
  // replaces a saved area with a rule for the element it covers (REQ-024-51)
  onUseElement: (areaId: string) => void;
  onOpenArea: (areaId: string) => void;
  pinnedMark?: string;
  onPinMark: (id: string) => void;
  // the dialog is adding or removing a rule
  ruleBusy?: boolean;
  /** opens the bug dialog, with a changed area already marked (REQ-025-03) */
  onReportBug?: (region?: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => void;
  // bugs filed from the comparison for this check (REQ-025-60)
  bugs?: VisualBug[];
  bugMarks?: boolean;
  onBugMarksChange?: (on: boolean) => void;
  // findings framed on the screenshot, switched beside them (REQ-003-14)
  a11yMarks?: boolean;
  onA11yMarksChange?: (on: boolean) => void;
}

type RuleDraft = {
  selector: string;
  // what the selector was picked from, when picked on the screenshot
  element?: string;
  action: "ignore" | "tolerate" | "compare";
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
  pickedElement,
  onPickedDone,
  onPreviewElement,
  onPreviewViolation,
  onPreviewRegion,
  onPreviewMark,
  onUseElement,
  onOpenArea,
  pinnedMark,
  onPinMark,
  ruleBusy,
  onReportBug,
  bugs = [],
  bugMarks = true,
  onBugMarksChange,
  a11yMarks = true,
  onA11yMarksChange,
}) => {
  const { enqueueSnackbar } = useSnackbar();
  const { t, tx } = useT();
  const { user } = useUserState();
  const { projectList, selectedProjectId } = useProjectState();
  const project = projectList.find((p) => p.id === selectedProjectId);
  // a personal token, or the project's shared one
  const jiraReady =
    !!project?.jiraUrl && (!!user?.jiraTokenSet || !!project?.jiraTokenSet);
  const canEdit = user?.role === "admin" || user?.role === "editor";
  const withUiTree = hasUiTree(testRun);

  const [tab, setTab] = React.useState<"a11y" | "changes">(
    withUiTree ? "a11y" : "changes",
  );
  const [ruleDraft, setRuleDraft] = React.useState<RuleDraft | null>(null);
  const [advancedSelector, setAdvancedSelector] = React.useState(false);
  const [selectorMatches, setSelectorMatches] =
    React.useState<SelectorMatches | null>(null);
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
  // a rule for every screen waiting for the confirmation to remove it (REQ-019-05)
  const [removing, setRemoving] = React.useState<
    StructureInfo["rules"][number] | null
  >(null);

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
        t("panel.linked", { key: key.toUpperCase() }),
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
        enqueueSnackbar(t("panel.noSuggestions"), { variant: "info" });
    } catch (error) {
      enqueueSnackbar(`${error}`, { variant: "error" });
    } finally {
      setLabelsLoading(false);
    }
  };

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text).then(
      () => enqueueSnackbar(t("panel.copied"), { variant: "success" }),
      () => enqueueSnackbar(text, { variant: "info" }),
    );
  };

  // an ignore rule for this screen, straight from a noise hint (REQ-024-40)
  const ignoreElement = async (selector: string) => {
    if (
      await run(
        () =>
          insightsService.addElementRule(testRun.id, {
            scope: "screen",
            selector,
            action: "ignore",
          }),
        t("panel.ruleAdded"),
      )
    ) {
      onStructureChanged();
    }
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
      t("panel.ignoreAreaAdded"),
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
            {labelOf(t, "severity", violation.severity).toUpperCase()}
          </Typography>
        </Box>
        {several ? (
          <>
            <Typography sx={{ fontSize: 13, color: tokens.textSecondary }}>
              {tx(
                "panel.sameIssue",
                {
                  component: (
                    <Box
                      component="code"
                      sx={{ font: `500 12px ${tokens.mono}` }}
                    >
                      {component}
                    </Box>
                  ),
                },
                { count: problem.length },
              )}
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
              label={t(isNew ? "panel.new" : "panel.existing")}
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
                t("panel.bug"),
              )}
            />
          )}
          {filing && <StatusPill tone="changed" label={t("panel.filing")} />}
          <Tooltip title={t("panel.codeHelp")}>
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
            {t(
              violation.issue?.status === "ignored"
                ? "panel.elsewhereIgnored"
                : violation.issue?.status === "filing"
                  ? "panel.elsewhereFiling"
                  : "panel.elsewhereFiled",
              {
                prefix: component ? t("panel.problemOf", { component }) : "",
                screen: elsewhere,
              },
            )}
          </Box>
        )}
        {!!violation.issue?.related?.length && (
          <Typography
            sx={{ fontSize: 12.5, color: tokens.textSecondary }}
            data-testid="a11yRelated"
          >
            {t("panel.alsoFiled")}{" "}
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
              {t("panel.suggested")}{" "}
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
              {t("panel.copy")}
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
                    t("panel.unlinked"),
                  )
                }
              >
                {t(elsewhere ? "panel.unlinkEverywhere" : "panel.unlink")}
              </Button>
            ) : (
              <>
                {jiraReady && (
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => setBugFor({ problems: [problem] })}
                  >
                    {t("panel.createBug")}
                  </Button>
                )}
                <Button
                  size="small"
                  onClick={() => {
                    setJiraKey("");
                    setJiraDialog({ mode: "link", violationIds: ids });
                  }}
                >
                  {t("panel.linkExisting")}
                </Button>
                <Button
                  size="small"
                  sx={{ color: tokens.textSecondary }}
                  onClick={() => {
                    setIgnoreComment("");
                    setIgnoreFor(ids);
                  }}
                >
                  {t("panel.falsePositive")}
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
          {tx("panel.noTree", {
            code: (
              <code>
                TestRunOptions.builder().uiTree(driver.getPageSource())
              </code>
            ),
          })}
        </Typography>
      );
    }
    if (report === undefined)
      return <Skeleton variant="rounded" height={160} />;
    if (report === null) {
      return (
        <Typography variant="body2" color="textSecondary">
          {t("panel.treeFailed")}
        </Typography>
      );
    }
    const missingLabels = report.violations.some(
      (v) => v.rule === "missing-label",
    );
    return (
      <>
        {onA11yMarksChange && report.violations.length > 0 && (
          <FormControlLabel
            sx={{ alignSelf: "flex-end", mr: 0, mt: -0.5 }}
            control={
              <Switch
                size="small"
                checked={a11yMarks}
                onChange={(event) => onA11yMarksChange(event.target.checked)}
                data-testid="a11yMarksSwitch"
              />
            }
            label={
              <Typography variant="caption" color="textSecondary">
                {t("panel.highlightOnScreenshot")}
              </Typography>
            }
          />
        )}
        <Typography variant="body2" color="textSecondary">
          {t("panel.checkedFrom", {
            platform: report.format === "appium-ios" ? "iOS" : "Android",
          })}{" "}
          {report.baselineChecked
            ? tx(
                "panel.compared",
                {
                  new: (
                    <b style={{ color: tokens.text }}>
                      {t("panel.newCount", { count: report.summary.new })}
                    </b>
                  ),
                },
                {
                  existing: report.summary.existing,
                  fixed: report.summary.fixed,
                  reported: report.summary.reported
                    ? t("panel.withBug", { count: report.summary.reported })
                    : "",
                },
              )
            : t("panel.noBaselineTree")}
          {report.pixelsPerDpEstimated && t("panel.estimated")}
        </Typography>
        {!jiraReady && canEdit && (
          <Alert severity="info" sx={{ py: 0 }}>
            {project?.jiraUrl ? t("panel.addToken") : t("panel.addUrl")}
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
            {t("panel.fileAll", { count: toFile.length })}
          </Button>
        )}
        {report.resolved.map((item) => (
          <Alert key={item.violationId} severity="success" sx={{ py: 0 }}>
            {tx("panel.resolved", {
              key: item.jiraUrl ? (
                <Link href={item.jiraUrl} target="_blank" rel="noreferrer">
                  {item.jiraKey}
                </Link>
              ) : (
                item.jiraKey
              ),
            })}
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
            {t(labelsLoading ? "panel.askingAi" : "panel.suggestLabels")}
          </Button>
        )}
        {report.violations.length === 0 && (
          <Typography variant="body2">{t("panel.noIssues")}</Typography>
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
              {t("panel.falsePositives", { count: report.ignored.length })}
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
                    ? t("panel.onScreen", {
                        screen:
                          violation.issue.screenTitle ||
                          violation.issue.screenName,
                      })
                    : ""}
                </span>
                {canEdit && (
                  <Button
                    size="small"
                    onClick={() =>
                      run(
                        () =>
                          insightsService.resetA11y(testRun.id, [violation.id]),
                        t("panel.restored"),
                      )
                    }
                  >
                    {violation.issue?.screenName
                      ? t("panel.restoreEverywhere")
                      : t("panel.restore")}
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

  // what the typed selector finds, a moment after typing stops (REQ-027-31, REQ-027-32)
  const draftSelector = ruleDraft?.selector.trim() ?? "";
  React.useEffect(() => {
    setSelectorMatches(null);
    if (!ruleOpen || !draftSelector) return;
    let current = true;
    const timer = setTimeout(() => {
      insightsService
        .selectorMatches(testRun.id, draftSelector)
        .then((matches) => current && setSelectorMatches(matches))
        .catch(() => undefined);
    }, 300);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [ruleOpen, draftSelector, testRun.id]);
  const selectorNote = selectorMatches?.problem
    ? t(`panel.selectorProblem.${selectorMatches.problem}`)
    : selectorMatches
      ? t("panel.matchCount", {
          baseline: selectorMatches.baseline,
          current: selectorMatches.current,
        })
      : null;

  const removeRule = async (rule: StructureInfo["rules"][number]) => {
    if (
      await run(
        () =>
          insightsService.removeElementRule(testRun.id, rule.scope, rule.id),
        t("panel.ruleRemoved"),
      )
    ) {
      setRemoving(null);
      onStructureChanged();
    }
  };

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
        ? t("panel.ruleAddedProject")
        : t("panel.ruleAdded"),
    );
    if (ok) {
      closeRule();
      onStructureChanged();
    }
  };

  // Ignore at hand; Compare only and Allow changes one step away (REQ-024-41)
  const [actionsFor, setActionsFor] = React.useState<{
    anchor: HTMLElement;
    resourceId: string;
  } | null>(null);
  // quiet icons: a text button on every row drowned the elements out
  const quietIcon = {
    width: 28,
    height: 28,
    color: tokens.textMuted,
    "&:hover, &:focus-visible": { color: tokens.brand },
  } as const;
  const elementActions = (resourceId: string | null) =>
    canEdit && resourceId ? (
      <>
        <Tooltip title={t("panel.ignoreElement")}>
          <IconButton
            size="small"
            aria-label={t("panel.ignore")}
            onClick={() => openRule(resourceId, "ignore")}
            sx={quietIcon}
          >
            <VisibilityOffOutlined sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
        <IconButton
          size="small"
          aria-label={t("compared.more")}
          data-testid="changedAreaMore"
          onClick={(event) =>
            setActionsFor({ anchor: event.currentTarget, resourceId })
          }
          sx={quietIcon}
        >
          <MoreHoriz sx={{ fontSize: 18 }} />
        </IconButton>
      </>
    ) : null;

  const rowSx = {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    alignItems: "center",
    columnGap: 1,
    py: 0.5,
    px: 1,
    mx: -1,
    borderRadius: 1,
    "&:hover": { bgcolor: tokens.subtle },
  } as const;

  const sectionTitle = (title: string, count: number) => (
    <Typography variant="subtitle2" sx={{ mb: 0.25 }}>
      {title}
      <Box component="span" sx={{ color: tokens.textMuted, ml: 0.75 }}>
        {count}
      </Box>
    </Typography>
  );

  const actionsCell = (children: React.ReactNode) => (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
      {children}
    </Box>
  );

  // the name leads; the type and the id follow quietly, so twenty rows stay scannable
  const elementCell = (element: string) => {
    const { type, name, id } = splitElement(element);
    return (
      <Box sx={{ minWidth: 0 }}>
        <Box
          sx={{
            fontSize: 14,
            lineHeight: 1.35,
            color: tokens.text,
            overflowWrap: "anywhere",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
          title={name ?? undefined}
        >
          {name ?? type}
        </Box>
        <Box
          sx={{
            fontSize: 12,
            lineHeight: 1.4,
            color: tokens.textMuted,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
          title={id ?? undefined}
        >
          {name ? type : null}
          {name && id ? " · " : null}
          {id && (
            <Box component="span" sx={{ font: `400 12px ${tokens.mono}` }}>
              {id}
            </Box>
          )}
        </Box>
      </Box>
    );
  };

  const changesTab = () => {
    if (structure === undefined)
      return <Skeleton variant="rounded" height={120} />;
    if (!structure) {
      return (
        <Typography variant="body2" color="textSecondary">
          {t("panel.noDetails")}
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
      !structure.invisible.length;
    return (
      <>
        {bugs.length > 0 && (
          <Box
            sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}
            data-testid="screenBugs"
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography variant="subtitle2" sx={{ flex: 1 }}>
                {t("reportBug.bugsForScreen")}
              </Typography>
              {onBugMarksChange && bugs.some((bug) => bug.sameDevice) && (
                <FormControlLabel
                  sx={{ mr: 0 }}
                  control={
                    <Switch
                      size="small"
                      checked={bugMarks}
                      onChange={(event) =>
                        onBugMarksChange(event.target.checked)
                      }
                    />
                  }
                  label={
                    <Typography variant="caption" color="textSecondary">
                      {t("reportBug.bugMarks")}
                    </Typography>
                  }
                />
              )}
            </Box>
            {bugs.map((bug) => (
              <Box
                key={bug.id}
                sx={{
                  border: `1px solid ${tokens.border}`,
                  borderRadius: 2,
                  px: 1.25,
                  py: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: 0.25,
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                  <BugReport
                    sx={{ fontSize: 16, color: tokens.status.failed.fg }}
                  />
                  {bug.jiraUrl ? (
                    <Link
                      href={bug.jiraUrl}
                      target="_blank"
                      rel="noreferrer"
                      sx={{
                        fontFamily: tokens.mono,
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      {bug.jiraKey}
                    </Link>
                  ) : (
                    <Typography sx={{ fontFamily: tokens.mono, fontSize: 13 }}>
                      {bug.jiraKey}
                    </Typography>
                  )}
                </Box>
                <Typography variant="body2">{bug.summary}</Typography>
                <Typography variant="caption" color="textSecondary">
                  {t("reportBug.filedFrom", {
                    date: new Date(bug.createdAt).toLocaleDateString(),
                  })}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
        <WhatsCompared
          structure={structure}
          areas={JSON.parse(testRun.ignoreAreas ?? "[]") as IgnoreArea[]}
          testAreas={
            JSON.parse(testRun.tempIgnoreAreas ?? "[]") as IgnoreArea[]
          }
          onOpenArea={onOpenArea}
          pinnedMark={pinnedMark}
          onPinMark={onPinMark}
          canEdit={canEdit}
          busy={submitting || !!ruleBusy}
          onRemove={(rule) =>
            // a rule for every screen is asked about: it changes the whole project
            rule.scope === "project" ? setRemoving(rule) : removeRule(rule)
          }
          onUseElement={onUseElement}
          onPreview={(id) => onPreviewMark?.(id)}
        />
        {structure.invisible.length > 0 && (
          <Alert severity="error" sx={{ py: 0 }}>
            <b>{t("panel.invisible")}</b>
            {structure.invisible.map((change) => (
              <div key={`${change.kind}:${change.key}`}>
                {describeChange(change, t)}
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
              canEdit && hint.element ? (
                // a rule follows the element when the layout moves; an area does not (REQ-024-40)
                <Button
                  size="small"
                  data-testid="hintIgnoreElement"
                  onClick={() =>
                    hint.element && ignoreElement(hint.element.selector)
                  }
                >
                  {t("panel.ignore")}
                </Button>
              ) : hint.ignoreArea && canEdit ? (
                <Button
                  size="small"
                  onClick={() => addIgnoreArea(hint.ignoreArea!)}
                >
                  {t("panel.ignoreArea")}
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
              ? t("panel.noDetails")
              : t("panel.nothingChanged")}
          </Typography>
        )}
        {structure.regions.length > 0 && (
          <Box sx={{ display: "flex", flexDirection: "column" }}>
            {sectionTitle(t("panel.changedAreas"), structure.regions.length)}
            {groupAreas(structure.regions).map((group, index) => (
              <Box
                key={group.element ?? `area-${index}`}
                data-testid="changedArea"
                onMouseEnter={() => onPreviewRegion?.(group.bounds)}
                onMouseLeave={() => onPreviewRegion?.(undefined)}
                sx={rowSx}
              >
                {group.element ? (
                  elementCell(group.element)
                ) : (
                  <Box sx={{ fontSize: 14, color: tokens.textSecondary }}>
                    {t("panel.areaAt", { ...group.regions[0] })}
                  </Box>
                )}
                {actionsCell(
                  <>
                    {group.regions.length > 1 && (
                      <Tooltip
                        title={t("panel.spots", {
                          count: group.regions.length,
                        })}
                      >
                        <Box
                          component="span"
                          sx={{
                            font: `600 11px ${tokens.mono}`,
                            color: tokens.textSecondary,
                            bgcolor: tokens.subtle,
                            border: `1px solid ${tokens.border}`,
                            borderRadius: 1,
                            px: 0.5,
                            mr: 0.25,
                          }}
                        >
                          ×{group.regions.length}
                        </Box>
                      </Tooltip>
                    )}
                    {onReportBug && (
                      <Tooltip title={t("reportBug.fromChange")}>
                        <IconButton
                          size="small"
                          aria-label={t("reportBug.fromChange")}
                          onClick={() => onReportBug(group.bounds)}
                          data-testid="reportBugFromArea"
                          sx={quietIcon}
                        >
                          <BugReport sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Tooltip>
                    )}
                    {elementActions(group.resourceId)}
                  </>,
                )}
              </Box>
            ))}
          </Box>
        )}
        {visibleChanges.length > 0 && (
          <Box sx={{ display: "flex", flexDirection: "column" }}>
            {sectionTitle(t("panel.fromTree"), visibleChanges.length)}
            {visibleChanges.map((change) => (
              <Box key={`${change.kind}:${change.key}`} sx={rowSx}>
                <Box
                  sx={{
                    fontSize: 14,
                    lineHeight: 1.35,
                    minWidth: 0,
                    overflowWrap: "anywhere",
                  }}
                >
                  {describeChange(change, t)}
                </Box>
                {actionsCell(elementActions(change.resourceId || null))}
              </Box>
            ))}
          </Box>
        )}
        {structure.moves.length > 0 && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
            <Typography variant="subtitle2">{t("panel.moved")}</Typography>
            <Typography variant="body2" color="textSecondary">
              {t("panel.movedHelp")}
            </Typography>
            {structure.moves.slice(0, 8).map((move) => (
              <Typography key={move.key} variant="body2">
                {move.element}:{" "}
                {move.dyDp
                  ? t(move.dyDp > 0 ? "panel.down" : "panel.up", {
                      count: Math.abs(move.dyDp),
                    })
                  : ""}
                {move.dxDp && move.dyDp ? ", " : ""}
                {move.dxDp
                  ? t(move.dxDp > 0 ? "panel.right" : "panel.left", {
                      count: Math.abs(move.dxDp),
                    })
                  : ""}
              </Typography>
            ))}
          </Box>
        )}
        {structure.systemBars.length > 0 && (
          <Typography variant="body2" color="textSecondary">
            {t("panel.systemBars")}
          </Typography>
        )}
        {canEdit && withUiTree && (
          <Button
            size="small"
            sx={{ alignSelf: "flex-start" }}
            onClick={() => openRule(null)}
          >
            {t("panel.addRuleButton")}
          </Button>
        )}
      </>
    );
  };

  const newCount = report?.summary.new ?? testRun.a11yNewCount ?? 0;

  return (
    <Box
      component="aside"
      aria-label={t("panel.details")}
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
              {t("panel.accessibility")}{" "}
              {newCount > 0 && (
                <StatusPill
                  tone="changed"
                  label={t("builds.a11yNewPill", { count: newCount })}
                />
              )}
            </Box>
          }
        />
        <Tab
          value="changes"
          label={
            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              {t("panel.changes")}
              {(structure?.invisible.length ?? 0) > 0 && (
                <StatusPill tone="failed" label={structure?.invisible.length} />
              )}
            </Box>
          }
        />
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
        <DialogTitle>{t("panel.linkTitle")}</DialogTitle>
        <DialogContent
          sx={{ display: "flex", flexDirection: "column", gap: 2 }}
        >
          <Typography variant="body2" color="textSecondary">
            {t("panel.linkHelp")}
          </Typography>
          <TextField
            id="jira-key"
            label={t("panel.jiraIssue")}
            placeholder="MOB-1234"
            value={jiraKey}
            onChange={(e) => setJiraKey(e.target.value)}
            error={!!jiraKey && !JIRA_KEY.test(jiraKey.trim())}
            helperText={
              jiraKey && !JIRA_KEY.test(jiraKey.trim())
                ? t("panel.looksLike")
                : " "
            }
            onKeyDown={(e) => {
              if (e.key === "Enter" && JIRA_KEY.test(jiraKey.trim()))
                submitJira();
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setJiraDialog(null)}>
            {t("panel.cancel")}
          </Button>
          <Button
            variant="contained"
            disabled={submitting || !JIRA_KEY.test(jiraKey.trim())}
            onClick={submitJira}
          >
            {t("panel.link")}
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
        <DialogTitle>{t("panel.fpTitle")}</DialogTitle>
        <DialogContent
          sx={{ display: "flex", flexDirection: "column", gap: 2 }}
        >
          <Typography variant="body2" color="textSecondary">
            {t("panel.fpHelp")}
          </Typography>
          <TextField
            id="ignore-comment"
            label={t("panel.why")}
            value={ignoreComment}
            onChange={(e) => setIgnoreComment(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIgnoreFor(null)}>
            {t("panel.cancel")}
          </Button>
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
                  t("panel.fpDone"),
                ))
              ) {
                setIgnoreFor(null);
              }
            }}
          >
            {t("panel.fpTitle")}
          </Button>
        </DialogActions>
      </Dialog>
      <Menu
        open={!!actionsFor}
        anchorEl={actionsFor?.anchor}
        onClose={() => setActionsFor(null)}
      >
        <MenuItem
          onClick={() => {
            if (actionsFor) openRule(actionsFor.resourceId, "compare");
            setActionsFor(null);
          }}
        >
          {t("select.compare")}
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (actionsFor) openRule(actionsFor.resourceId, "tolerate");
            setActionsFor(null);
          }}
        >
          {t("panel.allowSmall")}
        </MenuItem>
      </Menu>
      <Dialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>{t("panel.removeProjectRuleTitle")}</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            {tx("panel.removeProjectRuleText", {
              selector: (
                <Box component="code" sx={{ font: `500 12px ${tokens.mono}` }}>
                  {removing?.selector}
                </Box>
              ),
            })}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRemoving(null)}>{t("panel.cancel")}</Button>
          <Button
            color="error"
            variant="contained"
            disabled={submitting}
            onClick={() => removing && removeRule(removing)}
          >
            {t("panel.removeRule")}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={!!ruleDraft} onClose={closeRule} fullWidth maxWidth="xs">
        <DialogTitle>
          {ruleDraft?.action === "tolerate"
            ? t("panel.allowSmall")
            : ruleDraft?.action === "compare"
              ? t("select.compare")
              : t("panel.ignoreElement")}
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
            getOptionLabel={(item) => elementLabel(item, t)}
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
                  <Typography variant="body2">
                    {elementLabel(item, t)}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    {item.selector}
                  </Typography>
                </Box>
              </li>
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                label={t("panel.element")}
                placeholder={t("panel.elementPlaceholder")}
                helperText={
                  chosenElement
                    ? t("panel.foundBy", {
                        by: chosenElement.selector.replace(/:.*/, ""),
                      })
                    : !elementOptions.length
                      ? t("panel.noElements")
                      : " "
                }
              />
            )}
          />
          <Box sx={{ display: "flex", gap: 1, mt: -1.5 }}>
            <Button
              size="small"
              sx={{ color: tokens.textSecondary, ml: "auto" }}
              onClick={() => setAdvancedSelector((value) => !value)}
            >
              {t(
                advancedSelector
                  ? "panel.hideSelector"
                  : "panel.matchDifferently",
              )}
            </Button>
          </Box>
          {(advancedSelector || (!!ruleDraft?.selector && !chosenElement)) && (
            <TextField
              id="rule-selector"
              size="small"
              label={t("panel.selector")}
              value={ruleDraft?.selector ?? ""}
              onChange={(e) =>
                ruleDraft &&
                setRuleDraft({
                  ...ruleDraft,
                  selector: e.target.value,
                  element: undefined,
                })
              }
              error={!!selectorMatches?.problem}
              helperText={selectorNote ?? t("panel.selectorHelp")}
            />
          )}
          <TextField
            id="rule-action"
            select
            label={t("panel.whatToDo")}
            value={ruleDraft?.action ?? "ignore"}
            onChange={(e) => {
              if (!ruleDraft) return;
              const action = e.target.value as RuleDraft["action"];
              // compare only is for one screen (REQ-024-16)
              setRuleDraft({
                ...ruleDraft,
                action,
                scope: action === "compare" ? "screen" : ruleDraft.scope,
              });
            }}
          >
            <MenuItem value="ignore">{t("panel.ignoreAnywhere")}</MenuItem>
            <MenuItem value="tolerate">{t("panel.allowInside")}</MenuItem>
            <MenuItem value="compare">{t("select.compare")}</MenuItem>
          </TextField>
          {ruleDraft?.action === "tolerate" && (
            <TextField
              id="rule-percent"
              type="number"
              label={t("panel.share")}
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
            label={t("panel.where")}
            value={ruleDraft?.scope ?? "screen"}
            onChange={(e) =>
              ruleDraft &&
              setRuleDraft({
                ...ruleDraft,
                scope: e.target.value as RuleDraft["scope"],
              })
            }
          >
            <MenuItem value="screen">
              {t("panel.thisScreenOf", { name: testRun.name })}
            </MenuItem>
            <MenuItem
              value="project"
              disabled={ruleDraft?.action === "compare"}
            >
              {t("panel.everyScreen")}
            </MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeRule}>{t("panel.cancel")}</Button>
          <Button
            variant="contained"
            disabled={
              submitting ||
              !/^(id|class|text|xpath):.+/.test(draftSelector) ||
              !!selectorMatches?.problem
            }
            onClick={saveRule}
          >
            {t("panel.addRule")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
