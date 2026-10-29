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
import { useT } from "../../i18n";

import {
  JIRA_KEY,
  countUse,
  fieldsKey,
  lastParentKey,
  mostUsed,
  parentKeyFor,
  read,
  usageKey,
  write,
} from "../../_helpers/jiraMemory";

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
  const { t } = useT();
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
      enqueueSnackbar(t("bug.filed", { keys: created.join(", ") }), {
        variant: "success",
      });
    }
    if (linked.length) {
      enqueueSnackbar(
        t("bug.linkedAlready", { keys: [...new Set(linked)].join(", ") }),
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
          ? t("bug.titleMany", { count: problems.length })
          : t("bug.title")}
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
          label={t("bug.task")}
          placeholder="P24MOB-14136"
          value={parentKey}
          onChange={(event) => setParentKey(event.target.value)}
          error={!!parentKey && !keyValid}
          helperText={
            parentKey && !keyValid
              ? t("bug.looksLike")
              : prep
                ? `${prep.parent.summary}${prep.parent.assignee ? ` — ${prep.parent.assignee}` : ""}`
                : t("bug.taskHelp")
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
                label={t("bug.issueType")}
                value={issueTypeId ?? ""}
                onChange={(event) => setIssueTypeId(event.target.value)}
                sx={{ flex: "1 1 200px" }}
              >
                {prep.issueTypes.map((type) => (
                  <MenuItem key={type.id} value={type.id}>
                    {type.name}
                    {type.subtask ? t("bug.subtask") : ""}
                  </MenuItem>
                ))}
              </TextField>
              {issueType && !issueType.subtask && prep.linkTypes.length > 0 && (
                <TextField
                  id="jira-link-type"
                  select
                  label={t("bug.linkAs")}
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
                {t("bug.subtaskOf", { key: prep.parent.key })}
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
                  ? t("bug.andMore", {
                      summary: prep.summary,
                      count: problems.length - 1,
                    })
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
                  {item.source === "task" ? t("bug.fromTask") : ""}
                </Typography>
              ))}
              <Typography variant="body2" color="textSecondary">
                {t(
                  problems.length > 1 ? "bug.problemIdMany" : "bug.problemId",
                  {
                    code: prep.problem.code,
                  },
                )}
                {prep.problem.everyScreen &&
                  t("bug.everyScreen", {
                    component: prep.problem.component ?? t("bug.theClass"),
                  })}
              </Typography>
              {!!prep.markers?.length && (
                <Typography variant="body2" color="textSecondary">
                  {t("bug.labels")}{" "}
                  <span style={{ fontFamily: tokens.mono, fontSize: 12 }}>
                    {prep.markers.join(" ")}
                  </span>
                </Typography>
              )}
              <Typography variant="body2" color="textSecondary">
                {t("bug.description")}
                {problems.some((problem) => problem.length > 1) &&
                  t("bug.onePerProblem")}
              </Typography>
            </Box>
            {problems.length === 1 && prep.existing && (
              <Alert severity="warning" data-testid="jiraExisting">
                {t(
                  prep.existing.status === "reported"
                    ? "bug.existingFiled"
                    : prep.existing.status === "filing"
                      ? "bug.existingFiling"
                      : "bug.existingIgnored",
                  {
                    key: prep.existing.jiraKey ?? "",
                    screen:
                      prep.existing.screenTitle ||
                      prep.existing.screenName ||
                      "",
                  },
                )}
              </Alert>
            )}
            {problems.length === 1 &&
              prep.inJira.some((issue) => !issue.done) && (
                <Alert severity="warning" data-testid="jiraFound">
                  {t("bug.found", {
                    issues: prep.inJira
                      .filter((issue) => !issue.done)
                      .map((issue) => `${issue.key} (${issue.status})`)
                      .join(", "),
                    code: prep.problem.code,
                  })}
                </Alert>
              )}
            {problems.length === 1 &&
              prep.inJira.length > 0 &&
              prep.inJira.every((issue) => issue.done) && (
                <Alert severity="info">
                  {t("bug.filedBefore", {
                    code: prep.problem.code,
                    keys: prep.inJira.map((issue) => issue.key).join(", "),
                  })}
                </Alert>
              )}
            {cannotAsk.length > 0 && (
              <Alert severity="warning">
                {t("bug.cannotAsk", {
                  fields: cannotAsk.join(", "),
                  key: prep.parent.key,
                })}
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
              {t("bug.progress", { done: progress, total: problems.length })}
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={progress !== null}>
          {t("bug.cancel")}
        </Button>
        <Button variant="contained" disabled={!canCreate} onClick={create}>
          {problems.length > 1
            ? t("bug.createMany", { count: problems.length })
            : t("bug.create")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
