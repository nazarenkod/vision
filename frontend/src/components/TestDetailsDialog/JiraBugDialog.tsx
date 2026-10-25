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
import { A11yViolation, JiraBugPreparation, TestRun } from "../../types";
import { tokens } from "../../theme";

const JIRA_KEY = /^[A-Za-z][A-Za-z0-9_]*-\d+$/;

// Remembered in the browser: the task per screen, and how often each issue and
// link type was used, so the most frequent one is offered first.
const parentKeyFor = (projectId: string, screen: string) =>
  `vision.jira.parent.${projectId}.${screen}`;
const lastParentKey = (projectId: string) => `vision.jira.parent.${projectId}`;
const usageKey = (projectId: string, kind: "issueType" | "linkType") =>
  `vision.jira.${kind}.${projectId}`;

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
 * Files Jira bugs for one accessibility issue or for every open one of the
 * screenshot, under a task: as its sub-task, or linked to it. Issue and link
 * types come from the task's Jira project, the most used ones first; the task
 * is remembered for the screen.
 */
export const JiraBugDialog: React.FunctionComponent<{
  testRun: TestRun;
  violations: A11yViolation[];
  onClose: () => void;
  onDone: () => void;
}> = ({ testRun, violations, onClose, onDone }) => {
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
  const keyValid = JIRA_KEY.test(parentKey.trim());
  const first = violations[0];

  // Jira is asked once the key looks complete, and again when the type changes
  const preparedFor = React.useRef("");
  React.useEffect(() => {
    if (!keyValid || !first) {
      setPrep(null);
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
          first.id,
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
  const canCreate =
    !!prep && !!issueType && !prep.missing.length && progress === null;

  const create = async () => {
    if (!prep || !issueType) return;
    const key = parentKey.trim().toUpperCase();
    write(parentKeyFor(projectId, testRun.name), key);
    write(lastParentKey(projectId), key);
    countUse(usageKey(projectId, "issueType"), issueType.id);
    if (!issueType.subtask && linkType)
      countUse(usageKey(projectId, "linkType"), linkType);

    const created: string[] = [];
    setProgress(0);
    for (const violation of violations) {
      try {
        const result = await insightsService.fileA11yBug(
          testRun.id,
          violation.id,
          {
            parentKey: key,
            issueTypeId: issueType.id,
            ...(issueType.subtask || !linkType ? {} : { linkType }),
          },
        );
        created.push(result.jiraKey);
        result.warnings.forEach((warning) =>
          enqueueSnackbar(`${result.jiraKey}: ${warning}`, {
            variant: "warning",
          }),
        );
      } catch (e) {
        enqueueSnackbar(`${violation.title}: ${e}`, { variant: "error" });
      }
      setProgress(created.length);
    }
    setProgress(null);
    if (created.length) {
      enqueueSnackbar(`Filed ${created.join(", ")}`, { variant: "success" });
    }
    onDone();
    if (created.length === violations.length) onClose();
  };

  return (
    <Dialog
      open
      onClose={progress === null ? onClose : undefined}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle>
        {violations.length > 1
          ? `Create Jira bugs for ${violations.length} issues`
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
                {violations.length > 1
                  ? `${prep.summary} and ${violations.length - 1} more`
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
                Description: service, screen, actual and expected result,
                device, element; screenshot with the problem outlined.
              </Typography>
            </Box>
            {prep.missing.length > 0 && (
              <Alert severity="warning">
                Jira requires fields Vision cannot fill for this issue type:{" "}
                {prep.missing.join(", ")}. Fill them on {prep.parent.key} or
                pick another issue type.
              </Alert>
            )}
          </>
        )}
        {progress !== null && (
          <Box>
            <LinearProgress
              variant="determinate"
              value={(progress / violations.length) * 100}
            />
            <Typography variant="caption" color="textSecondary">
              {progress} of {violations.length}
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={progress !== null}>
          Cancel
        </Button>
        <Button variant="contained" disabled={!canCreate} onClick={create}>
          {violations.length > 1
            ? `Create ${violations.length} bugs`
            : "Create bug"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
