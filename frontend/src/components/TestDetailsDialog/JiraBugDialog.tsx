import React from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  MenuItem,
  TextField,
  Typography,
} from "@mui/material";
import { useSnackbar } from "notistack";
import { insightsService } from "../../services";
import { useProjectState } from "../../contexts";
import {
  A11yViolation,
  JiraBugInput,
  JiraBugPreparation,
  TestRun,
} from "../../types";
import { ChosenValue, JiraFieldInput } from "./JiraFieldInput";
import { tokens } from "../../theme";

const JIRA_KEY = /^[A-Za-z][A-Za-z0-9_]*-\d+$/;

// Remembered in the browser: the task per screen, and how often each issue and
// link type was used, so the most frequent one is offered first.
const parentKeyFor = (projectId: string, screen: string) =>
  `vision.jira.parent.${projectId}.${screen}`;
const lastParentKey = (projectId: string) => `vision.jira.parent.${projectId}`;
const usageKey = (projectId: string, kind: "issueType" | "linkType") =>
  `vision.jira.${kind}.${projectId}`;
// field values chosen last time (customer, severity…), by Jira field id
const fieldsKey = (projectId: string) => `vision.jira.fields.${projectId}`;

const read = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // a convenience only
  }
};
const usage = (key: string): Record<string, number> => {
  try {
    return JSON.parse(read(key) ?? "{}") ?? {};
  } catch {
    return {};
  }
};
const countUse = (key: string, value: string) =>
  write(
    key,
    JSON.stringify({ ...usage(key), [value]: (usage(key)[value] ?? 0) + 1 }),
  );
const mostUsed = (key: string, options: string[]): string | null => {
  const counts = usage(key);
  return (
    options
      .filter((option) => counts[option])
      .sort((a, b) => counts[b] - counts[a])[0] ?? null
  );
};

/**
 * Files Jira bugs for one problem or for every open one of the screenshot, one
 * bug per problem (an issue on every element of one component), under a task:
 * as its sub-task, or linked to it. Problems filed already elsewhere get linked
 * to that bug instead. Issue and link types come from the task's Jira project,
 * the most used ones first; the task is remembered for the screen.
 */
export const JiraBugDialog: React.FunctionComponent<{
  testRun: TestRun;
  // each problem is the issues of one rule on one component
  problems: A11yViolation[][];
  onClose: () => void;
  onDone: () => void;
}> = ({ testRun, problems, onClose, onDone }) => {
  const { enqueueSnackbar } = useSnackbar();
  const { selectedProjectId } = useProjectState();
  const projectId = selectedProjectId ?? "";
  const [parentKey, setParentKey] = React.useState(
    () =>
      read(parentKeyFor(projectId, testRun.name)) ??
      read(lastParentKey(projectId)) ??
      "",
  );
  const [prep, setPrep] = React.useState<JiraBugPreparation | null>(null);
  const [issueTypeId, setIssueTypeId] = React.useState<string>();
  const [linkType, setLinkType] = React.useState<string>();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [progress, setProgress] = React.useState<number | null>(null);
  const [chosen, setChosen] = React.useState<Record<string, ChosenValue>>(
    () => {
      try {
        return JSON.parse(read(fieldsKey(projectId)) ?? "{}") ?? {};
      } catch {
        return {};
      }
    },
  );
  const keyValid = JIRA_KEY.test(parentKey.trim());
  const first = problems[0];
  const ids = (problem: A11yViolation[]) => problem.map((v) => v.id);

  // Jira is asked once the key looks complete, and again when the type changes
  const preparedFor = React.useRef("");
  React.useEffect(() => {
    if (!keyValid || !first) {
      setPrep(null);
      setError(null);
      preparedFor.current = "";
      return;
    }
    const key = parentKey.trim().toUpperCase();
    if (preparedFor.current === `${key}|${issueTypeId ?? ""}`) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await insightsService.prepareA11yBug(
          testRun.id,
          ids(first),
          key,
          issueTypeId,
        );
        if (cancelled) return;
        // a type of another task's project does not count
        let wanted = result.issueTypes.some((type) => type.id === issueTypeId)
          ? issueTypeId
          : undefined;
        if (!wanted) {
          const preferred = mostUsed(
            usageKey(projectId, "issueType"),
            result.issueTypes.map((type) => type.id),
          );
          if (preferred && preferred !== result.issueTypeId) {
            // the type used most often wins; its fields come with the next answer
            setIssueTypeId(preferred);
            return;
          }
          wanted = result.issueTypeId;
        }
        preparedFor.current = `${key}|${wanted}`;
        setIssueTypeId(wanted);
        setLinkType(
          (current) =>
            (current && result.linkTypes.includes(current)
              ? current
              : undefined) ??
            mostUsed(usageKey(projectId, "linkType"), result.linkTypes) ??
            result.linkType ??
            undefined,
        );
        setPrep(result);
      } catch (e) {
        if (!cancelled) {
          setPrep(null);
          preparedFor.current = "";
          setError(String(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [keyValid, parentKey, issueTypeId, first, testRun.id, projectId]);

  const issueType = prep?.issueTypes.find((type) => type.id === issueTypeId);
  const inputs = prep?.inputs ?? [];
  const valueOf = (input: JiraBugInput) =>
    chosen[input.id]?.value ?? input.value;
  const emptyRequired = inputs.filter(
    (input) =>
      input.required &&
      (valueOf(input) === undefined || valueOf(input) === null),
  );
  // required fields of a kind the dialog cannot ask for
  const cannotAsk = (prep?.missing ?? []).filter(
    (name) => !inputs.some((input) => input.name === name),
  );
  const canCreate =
    !!prep &&
    !!issueType &&
    !emptyRequired.length &&
    !cannotAsk.length &&
    progress === null;

  const create = async () => {
    if (!prep || !issueType) return;
    const key = parentKey.trim().toUpperCase();
    write(parentKeyFor(projectId, testRun.name), key);
    write(lastParentKey(projectId), key);
    countUse(usageKey(projectId, "issueType"), issueType.id);
    const remembered = Object.fromEntries(
      inputs
        .filter((input) => chosen[input.id])
        .map((input) => [input.id, chosen[input.id]]),
    );
    write(fieldsKey(projectId), JSON.stringify({ ...chosen, ...remembered }));
    const fieldValues = Object.fromEntries(
      inputs
        .filter(
          (input) => valueOf(input) !== undefined && valueOf(input) !== null,
        )
        .map((input) => [input.id, valueOf(input)]),
    );
    if (!issueType.subtask && linkType)
      countUse(usageKey(projectId, "linkType"), linkType);

    const linked: string[] = [];
    const created: string[] = [];
    setProgress(0);
    for (const problem of problems) {
      try {
        const result = await insightsService.fileA11yBug(
          testRun.id,
          ids(problem),
          {
            parentKey: key,
            issueTypeId: issueType.id,
            ...(issueType.subtask || !linkType ? {} : { linkType }),
            fieldValues,
          },
        );
        // filed meanwhile by a colleague, or found in Jira by the problem's id
        (result.alreadyFiled ? linked : created).push(result.jiraKey);
        result.warnings.forEach((warning) =>
          enqueueSnackbar(`${result.jiraKey}: ${warning}`, {
            variant: "warning",
          }),
        );
      } catch (e) {
        enqueueSnackbar(`${problem[0].title}: ${e}`, { variant: "error" });
      }
      setProgress(created.length + linked.length);
    }
    setProgress(null);
    if (created.length) {
      enqueueSnackbar(`Filed ${created.join(", ")}`, { variant: "success" });
    }
    if (linked.length) {
      enqueueSnackbar(
        `Filed already, linked: ${[...new Set(linked)].join(", ")}`,
        { variant: "info" },
      );
    }
    onDone();
    if (created.length + linked.length === problems.length) onClose();
  };

  return (
    <Dialog
      open
      onClose={progress === null ? onClose : undefined}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle>
        {problems.length > 1
          ? `Create Jira bugs for ${problems.length} problems`
          : "Create Jira bug"}
      </DialogTitle>
      <DialogContent
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
          pt: "8px !important",
        }}
      >
        <TextField
          id="jira-parent"
          label="Task"
          placeholder="P24MOB-14136"
          value={parentKey}
          onChange={(event) => setParentKey(event.target.value)}
          error={!!parentKey && !keyValid}
          helperText={
            parentKey && !keyValid
              ? "Looks like ABC-123"
              : prep
                ? `${prep.parent.summary}${prep.parent.assignee ? ` — ${prep.parent.assignee}` : ""}`
                : "The bug goes under this task, into its project. Remembered for this screen."
          }
        />
        {loading && <LinearProgress />}
        {error && <Alert severity="error">{error}</Alert>}
        {prep && (
          <>
            <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
              <TextField
                id="jira-issue-type"
                select
                label="Issue type"
                value={issueTypeId ?? ""}
                onChange={(event) => setIssueTypeId(event.target.value)}
                sx={{ flex: "1 1 200px" }}
              >
                {prep.issueTypes.map((type) => (
                  <MenuItem key={type.id} value={type.id}>
                    {type.name}
                    {type.subtask ? " (sub-task)" : ""}
                  </MenuItem>
                ))}
              </TextField>
              {issueType && !issueType.subtask && prep.linkTypes.length > 0 && (
                <TextField
                  id="jira-link-type"
                  select
                  label="Link to the task as"
                  value={linkType ?? ""}
                  onChange={(event) => setLinkType(event.target.value)}
                  sx={{ flex: "1 1 200px" }}
                >
                  {prep.linkTypes.map((name) => (
                    <MenuItem key={name} value={name}>
                      {name}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            </Box>
            {issueType?.subtask && (
              <Typography variant="body2" color="textSecondary">
                Created as a sub-task of {prep.parent.key}.
              </Typography>
            )}
            {inputs.map((input) => (
              <JiraFieldInput
                key={`${issueTypeId}-${input.id}`}
                testRunId={testRun.id}
                input={input}
                chosen={chosen[input.id]}
                onChange={(value) =>
                  setChosen((current) => {
                    const next = { ...current };
                    if (value) next[input.id] = value;
                    else delete next[input.id];
                    return next;
                  })
                }
              />
            ))}
            <Box
              sx={{
                bgcolor: tokens.subtle,
                border: `1px solid ${tokens.border}`,
                borderRadius: 2,
                p: 1.5,
                display: "flex",
                flexDirection: "column",
                gap: 0.5,
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {problems.length > 1
                  ? `${prep.summary} and ${problems.length - 1} more`
                  : prep.summary}
              </Typography>
              {prep.filled.map((item) => (
                <Typography
                  key={item.field}
                  variant="body2"
                  color="textSecondary"
                >
                  {item.field}:{" "}
                  <span style={{ color: tokens.text }}>{item.value}</span>
                  {item.source === "task" ? " (from the task)" : ""}
                </Typography>
              ))}
              <Typography variant="body2" color="textSecondary">
                Problem id {prep.problem.code}
                {problems.length > 1 ? " and one per problem" : ""}: in the
                summary, labels and description, to find the bug in Jira.
                {prep.problem.everyScreen &&
                  ` One bug for ${prep.problem.component ?? "the class"} on every screen.`}
              </Typography>
              {!!prep.markers?.length && (
                <Typography variant="body2" color="textSecondary">
                  Labels:{" "}
                  <span style={{ fontFamily: tokens.mono, fontSize: 12 }}>
                    {prep.markers.join(" ")}
                  </span>
                </Typography>
              )}
              <Typography variant="body2" color="textSecondary">
                Description: service, screen, actual and expected result,
                device, element; screenshot with the problem outlined.
                {problems.some((problem) => problem.length > 1) &&
                  " One bug per problem: the same issue on several elements of one component goes into one bug with all of them."}
              </Typography>
            </Box>
            {problems.length === 1 && prep.existing && (
              <Alert severity="warning" data-testid="jiraExisting">
                {prep.existing.status === "reported"
                  ? `Filed already as ${prep.existing.jiraKey}`
                  : prep.existing.status === "filing"
                    ? "A bug is being filed right now"
                    : "Marked as a false positive"}{" "}
                from screen “
                {prep.existing.screenTitle || prep.existing.screenName}”.
                Creating will not file another one.
              </Alert>
            )}
            {problems.length === 1 &&
              prep.inJira.some((issue) => !issue.done) && (
                <Alert severity="warning" data-testid="jiraFound">
                  Jira has{" "}
                  {prep.inJira
                    .filter((issue) => !issue.done)
                    .map((issue) => `${issue.key} (${issue.status})`)
                    .join(", ")}{" "}
                  with {prep.problem.code}: it will be linked instead of filing
                  a new bug.
                </Alert>
              )}
            {problems.length === 1 &&
              prep.inJira.length > 0 &&
              prep.inJira.every((issue) => issue.done) && (
                <Alert severity="info">
                  {prep.problem.code} was filed before as{" "}
                  {prep.inJira.map((issue) => issue.key).join(", ")} (done). The
                  problem is back, so a new bug makes sense.
                </Alert>
              )}
            {cannotAsk.length > 0 && (
              <Alert severity="warning">
                Jira requires fields Vision cannot ask for here:{" "}
                {cannotAsk.join(", ")}. Fill them on {prep.parent.key} or pick
                another issue type.
              </Alert>
            )}
          </>
        )}
        {progress !== null && (
          <Box>
            <LinearProgress
              variant="determinate"
              value={(progress / problems.length) * 100}
            />
            <Typography variant="caption" color="textSecondary">
              {progress} of {problems.length}
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={progress !== null}>
          Cancel
        </Button>
        <Button variant="contained" disabled={!canCreate} onClick={create}>
          {problems.length > 1
            ? `Create ${problems.length} bugs`
            : "Create bug"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
