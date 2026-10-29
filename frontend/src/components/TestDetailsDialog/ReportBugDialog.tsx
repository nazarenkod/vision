import React from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  FormControlLabel,
  IconButton,
  InputAdornment,
  LinearProgress,
  MenuItem,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  AutoAwesome,
  BugReport,
  Close,
  Refresh,
  Visibility,
} from "@mui/icons-material";
import { insightsService } from "../../services";
import { useProjectState, useUserState } from "../../contexts";
import { routes } from "../../constants";
import {
  JiraBugInput,
  StructureInfo,
  TestRun,
  TestStatus,
  VisualBugPreparation,
  VisualBugResult,
} from "../../types";
import { ChosenValue, JiraFieldInput } from "./JiraFieldInput";
import { BugEvidence } from "./BugEvidence";
import { describeChange } from "../ChangeGroups";
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
import {
  aiAvailable,
  applyDraft,
  BugForm,
  BugMark,
  canAskAi,
  DraftField,
  editField,
  emptyForm,
  missingFields,
  visibleInputs,
} from "../../_helpers/bugReport.helper";

type ChangeOption = {
  key: string;
  // shown in the dialog, in the interface's language
  label: string;
  // sent to the model, in English like the rest of its prompt
  text: string;
  bounds: { x: number; y: number; width: number; height: number };
};

const overlaps = (a: ChangeOption["bounds"], b: ChangeOption["bounds"]) =>
  a.x < b.x + b.width &&
  b.x < a.x + a.width &&
  a.y < b.y + b.height &&
  b.y < a.y + a.height;

const readRemembered = (projectId: string): Record<string, ChosenValue> => {
  try {
    return JSON.parse(read(fieldsKey(projectId)) ?? "{}") ?? {};
  } catch {
    return {};
  }
};

/**
 * A Jira bug about this screenshot (025): the person marks the problem, writes
 * the essence, steps and both results or lets Gemini draft them from a few
 * words, picks a severity, and Vision adds the rest: the [Automation] [feature]
 * prefix, the environment, both screenshots, the task's customer.
 */
export const ReportBugDialog: React.FunctionComponent<{
  testRun: TestRun;
  structure: StructureInfo | null;
  initialMarks?: BugMark[];
  onClose: () => void;
  onFiled: (result: VisualBugResult, rejected: boolean) => void;
}> = ({ testRun, structure, initialMarks, onClose, onFiled }) => {
  const { t } = useT();
  const { selectedProjectId } = useProjectState();
  const projectId = selectedProjectId ?? "";
  const [parentKey, setParentKey] = React.useState(
    () =>
      read(parentKeyFor(projectId, testRun.name)) ??
      read(lastParentKey(projectId)) ??
      "",
  );
  const [prep, setPrep] = React.useState<VisualBugPreparation | null>(null);
  const [issueTypeId, setIssueTypeId] = React.useState<string>();
  const [linkType, setLinkType] = React.useState<string>();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [chosen, setChosen] = React.useState<Record<string, ChosenValue>>({});
  const remembered = React.useMemo(
    () => readRemembered(projectId),
    [projectId],
  );
  const [marks, setMarks] = React.useState<BugMark[]>(initialMarks ?? []);
  const [form, setForm] = React.useState<BugForm>(emptyForm());
  const [drafted, setDrafted] = React.useState<Set<DraftField>>(new Set());
  const [edited, setEdited] = React.useState<Set<DraftField>>(new Set());
  const [note, setNote] = React.useState("");
  const [attempt, setAttempt] = React.useState(0);
  const [drafting, setDrafting] = React.useState(false);
  const [aiError, setAiError] = React.useState<string | null>(null);
  const canReject =
    testRun.status === TestStatus.unresolved ||
    testRun.status === TestStatus.new;
  const [reject, setReject] = React.useState(canReject);
  const [creating, setCreating] = React.useState(false);
  const keyValid = JIRA_KEY.test(parentKey.trim());
  const { user } = useUserState();
  const withAi = aiAvailable(user);

  const changes: ChangeOption[] = React.useMemo(
    () => [
      ...(structure?.regions ?? []).map((area, index) => ({
        key: `area:${index}`,
        label: area.element ?? t("panel.areaAt", { ...area.region }),
        text: area.element
          ? `Changed area: ${area.element}`
          : `Changed area at ${area.region.x}, ${area.region.y}`,
        bounds: area.region,
      })),
      ...(structure?.changes ?? []).map((change) => ({
        key: `tree:${change.kind}:${change.key}`,
        label: describeChange(change, t),
        text: describeChange(change),
        bounds: change.bounds,
      })),
    ],
    [structure, t],
  );
  const [ticked, setTicked] = React.useState<Set<string>>(
    () =>
      new Set(
        changes
          .filter((change) =>
            (initialMarks ?? []).some((mark) => overlaps(mark, change.bounds)),
          )
          .map((change) => change.key),
      ),
  );

  // Jira is asked once the key looks complete, and again when the type changes
  const preparedFor = React.useRef("");
  React.useEffect(() => {
    if (!keyValid) {
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
        const result = await insightsService.prepareVisualBug(
          testRun.id,
          key,
          issueTypeId,
        );
        if (cancelled) return;
        let wanted = result.issueTypes.some((type) => type.id === issueTypeId)
          ? issueTypeId
          : undefined;
        if (!wanted) {
          const preferred = mostUsed(
            usageKey(projectId, "issueType"),
            result.issueTypes.map((type) => type.id),
          );
          if (preferred && preferred !== result.issueTypeId) {
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
        setForm((current) =>
          current.environment
            ? current
            : { ...current, environment: result.environment },
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
  }, [keyValid, parentKey, issueTypeId, testRun.id, projectId]);

  const issueType = prep?.issueTypes.find((type) => type.id === issueTypeId);
  const inputs = prep?.inputs ?? [];
  // severity is chosen every time (REQ-025-23); other fields come back as last time
  const valueOf = (input: JiraBugInput): ChosenValue | undefined =>
    chosen[input.id] ??
    (input.role === "severity" ? undefined : remembered[input.id]);
  const chosenValues = Object.fromEntries(
    inputs
      .map((input) => [input.id, valueOf(input)?.value] as const)
      .filter(([, value]) => value !== undefined),
  );
  const missing = missingFields(form, inputs, chosenValues);
  const cannotAsk = (prep?.missing ?? []).filter(
    (name) => !inputs.some((input) => input.name === name),
  );
  const ready =
    !!prep &&
    !!issueType &&
    !missing.texts.length &&
    !missing.fields.length &&
    !cannotAsk.length &&
    !creating &&
    !drafting;

  const change = (field: keyof BugForm, value: string) => {
    const next = editField(form, field, value, drafted, edited);
    setForm(next.form);
    setDrafted(next.drafted);
    setEdited(next.edited);
  };

  const tickedChanges = changes.filter((option) => ticked.has(option.key));
  const askAi = async () => {
    const next = attempt + 1;
    setAttempt(next);
    setDrafting(true);
    setAiError(null);
    try {
      const draft = await insightsService.draftBug({
        testRunId: testRun.id,
        note,
        marks: marks.map(({ x, y, width, height }) => ({
          x,
          y,
          width,
          height,
        })),
        changes: tickedChanges.map((option) => option.text),
        attempt: next,
      });
      const result = applyDraft(form, draft, edited);
      setForm(result.form);
      setDrafted(result.drafted);
    } catch (e) {
      // the note, the marks and what the person wrote stay as they are
      setAiError(String(e));
    } finally {
      setDrafting(false);
    }
  };

  const create = async () => {
    if (!prep || !issueType) return;
    const key = parentKey.trim().toUpperCase();
    setCreating(true);
    try {
      const result = await insightsService.fileVisualBug(testRun.id, {
        parentKey: key,
        issueTypeId: issueType.id,
        ...(issueType.subtask || !linkType ? {} : { linkType }),
        fieldValues: chosenValues,
        essence: form.essence,
        environment: form.environment,
        steps: form.steps,
        actual: form.actual,
        expected: form.expected,
        marks: marks.map(({ x, y, width, height, element }) => ({
          x,
          y,
          width,
          height,
          ...(element ? { element } : {}),
        })),
      });
      write(parentKeyFor(projectId, testRun.name), key);
      write(lastParentKey(projectId), key);
      countUse(usageKey(projectId, "issueType"), issueType.id);
      if (!issueType.subtask && linkType)
        countUse(usageKey(projectId, "linkType"), linkType);
      const keep = Object.fromEntries(
        Object.entries({ ...remembered, ...chosen }).filter(
          ([id]) =>
            !inputs.some(
              (input) => input.id === id && input.role === "severity",
            ),
        ),
      );
      write(fieldsKey(projectId), JSON.stringify(keep));
      onFiled(result, reject && canReject);
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setCreating(false);
    }
  };

  const aiTag = (field: DraftField) =>
    drafted.has(field) ? (
      <Chip
        label={t("reportBug.aiTag")}
        size="small"
        icon={<AutoAwesome sx={{ fontSize: 12 }} />}
        sx={{
          height: 18,
          ml: 0.75,
          fontSize: 10,
          fontWeight: 700,
          bgcolor: tokens.brandSoft,
          color: tokens.brand,
          "& .MuiChip-icon": { color: tokens.brand },
        }}
        data-testid={`aiDrafted-${field}`}
      />
    ) : null;
  const label = (text: string, field?: DraftField) => (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center" }}>
      {text} *{field && aiTag(field)}
    </Box>
  );
  const textField = (
    field: DraftField | "environment",
    text: string,
    rows: number,
    placeholder?: string,
  ) => (
    <TextField
      label={label(text, field === "environment" ? undefined : field)}
      value={form[field]}
      onChange={(event) => change(field, event.target.value)}
      multiline
      minRows={rows}
      maxRows={rows + 3}
      placeholder={placeholder}
      error={
        field !== "environment" &&
        !!prep &&
        missing.texts.includes(field) &&
        edited.has(field)
      }
      inputProps={{ "data-testid": `bugField-${field}` }}
      fullWidth
      size="small"
    />
  );

  const missingNames = [
    ...missing.texts.map((field) => t(`reportBug.field.${field}`)),
    ...missing.fields,
  ];

  return (
    <Dialog
      open
      onClose={creating ? undefined : onClose}
      maxWidth={false}
      PaperProps={{
        sx: {
          width: "min(1000px, calc(100vw - 32px))",
          height: "min(720px, calc(100vh - 32px))",
          display: "flex",
          flexDirection: "column",
        },
      }}
      data-testid="reportBugDialog"
    >
      <Box
        sx={{
          height: 56,
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          pl: 2.5,
          pr: 1.5,
          borderBottom: `1px solid ${tokens.border}`,
          flexShrink: 0,
        }}
      >
        <BugReport sx={{ color: tokens.brand }} />
        <Typography variant="h6" sx={{ fontSize: 16, fontWeight: 650 }}>
          {t("reportBug.title")}
        </Typography>
        <Typography variant="body2" color="textSecondary" noWrap>
          {[testRun.name, testRun.os, testRun.device]
            .filter(Boolean)
            .join(" · ")}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <IconButton
          aria-label={t("common.cancel")}
          onClick={onClose}
          disabled={creating}
        >
          <Close />
        </IconButton>
      </Box>
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "372px minmax(0, 1fr)" },
          overflow: { xs: "auto", md: "hidden" },
        }}
      >
        <Box
          sx={{
            background: tokens.lightbox,
            borderRight: { md: `1px solid ${tokens.border}` },
            p: 2,
            overflow: "auto",
          }}
        >
          <BugEvidence
            testRun={testRun}
            marks={marks}
            onChange={setMarks}
            elements={structure?.elements ?? []}
            disabled={drafting || creating}
            width={340}
            height={420}
          />
        </Box>
        <Box
          sx={{
            p: 2.5,
            display: "flex",
            flexDirection: "column",
            gap: 2,
            overflow: "auto",
            minWidth: 0,
          }}
        >
          <Box sx={{ display: "flex", gap: 1.5 }}>
            <TextField
              id="bug-parent"
              label={t("bug.task")}
              placeholder="P24MOB-14136"
              value={parentKey}
              onChange={(event) => setParentKey(event.target.value)}
              error={!!parentKey && !keyValid}
              size="small"
              sx={{ flex: "1 1 200px" }}
              inputProps={{ style: { fontFamily: tokens.mono } }}
            />
            {prep && (
              <TextField
                select
                label={t("bug.issueType")}
                value={issueTypeId ?? ""}
                onChange={(event) => setIssueTypeId(event.target.value)}
                size="small"
                sx={{ flex: "1 1 180px" }}
              >
                {prep.issueTypes.map((type) => (
                  <MenuItem key={type.id} value={type.id}>
                    {type.name}
                    {type.subtask ? t("bug.subtask") : ""}
                  </MenuItem>
                ))}
              </TextField>
            )}
            {prep &&
              issueType &&
              !issueType.subtask &&
              prep.linkTypes.length > 0 && (
                <TextField
                  select
                  label={t("bug.linkAs")}
                  value={linkType ?? ""}
                  onChange={(event) => setLinkType(event.target.value)}
                  size="small"
                  sx={{ flex: "1 1 160px" }}
                >
                  {prep.linkTypes.map((name) => (
                    <MenuItem key={name} value={name}>
                      {name}
                    </MenuItem>
                  ))}
                </TextField>
              )}
          </Box>
          <Typography variant="body2" color="textSecondary" sx={{ mt: -1 }}>
            {parentKey && !keyValid
              ? t("bug.looksLike")
              : prep
                ? `${prep.parent.summary}${prep.parent.assignee ? ` — ${prep.parent.assignee}` : ""}`
                : t("bug.taskHelp")}
          </Typography>
          {loading && <LinearProgress />}
          {error && <Alert severity="error">{error}</Alert>}
          {withAi && (
            <Box
              sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}
              data-testid="bugAi"
            >
              <TextField
                label={`${t("reportBug.note")} *`}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                multiline
                minRows={2}
                maxRows={4}
                placeholder={t("reportBug.notePlaceholder")}
                size="small"
                inputProps={{ "data-testid": "bugNote" }}
                disabled={drafting}
              />
              <Box
                sx={{
                  display: "flex",
                  gap: 0.75,
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <Typography variant="caption" color="textSecondary">
                  {t("reportBug.add")}
                </Typography>
                {(
                  [
                    "cutOff",
                    "overlaps",
                    "unchanged",
                    "wrongText",
                    "missing",
                    "misaligned",
                  ] as const
                ).map((phrase) => (
                  <Chip
                    key={phrase}
                    size="small"
                    variant="outlined"
                    label={t(`reportBug.quick.${phrase}`)}
                    onClick={() =>
                      setNote((current) =>
                        [
                          current.trim(),
                          t(`reportBug.quick.${phrase}`).toLowerCase(),
                        ]
                          .filter(Boolean)
                          .join(current.trim() ? ", " : ""),
                      )
                    }
                    disabled={drafting}
                  />
                ))}
              </Box>
              {changes.length > 0 && (
                <Box>
                  <Typography variant="caption" color="textSecondary">
                    {t("reportBug.changesItLooksAt")}
                  </Typography>
                  {changes.map((option) => (
                    <FormControlLabel
                      key={option.key}
                      sx={{
                        display: "flex",
                        ml: 0,
                        "& .MuiFormControlLabel-label": { fontSize: 13 },
                      }}
                      control={
                        <Checkbox
                          size="small"
                          checked={ticked.has(option.key)}
                          onChange={(event) =>
                            setTicked((current) => {
                              const next = new Set(current);
                              if (event.target.checked) next.add(option.key);
                              else next.delete(option.key);
                              return next;
                            })
                          }
                          disabled={drafting}
                        />
                      }
                      label={option.label}
                    />
                  ))}
                </Box>
              )}
              <Box
                sx={{
                  display: "flex",
                  gap: 1,
                  alignItems: "flex-start",
                  bgcolor: tokens.status.new.bg,
                  borderRadius: 2,
                  px: 1.5,
                  py: 1,
                }}
              >
                <Visibility
                  sx={{ fontSize: 16, color: tokens.status.new.fg, mt: 0.25 }}
                />
                <Typography variant="body2" sx={{ fontSize: 12 }}>
                  {t("reportBug.aiGets", {
                    areas: Math.min(
                      3,
                      marks.length || (structure?.regions.length ?? 0),
                    ),
                    changes: tickedChanges.length,
                  })}
                </Typography>
              </Box>
              <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                <Button
                  variant="contained"
                  startIcon={attempt ? <Refresh /> : <AutoAwesome />}
                  onClick={askAi}
                  disabled={!canAskAi(note) || drafting || creating}
                  data-testid="fillWithAi"
                >
                  {drafting
                    ? t("reportBug.drafting")
                    : attempt
                      ? t("reportBug.askAgain")
                      : t("reportBug.fillWithAi")}
                </Button>
              </Box>
              {drafting && <LinearProgress />}
              {aiError && (
                <Alert severity="warning" data-testid="aiError">
                  {t("reportBug.aiFailed", { error: aiError })}
                </Alert>
              )}
            </Box>
          )}
          {!withAi && (
            <Alert
              severity="info"
              icon={<AutoAwesome fontSize="small" />}
              data-testid="needGeminiKey"
              action={
                <Button
                  size="small"
                  href={routes.PROFILE_PAGE}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t("reportBug.openProfile")}
                </Button>
              }
            >
              {t("reportBug.needGeminiKey")}
            </Alert>
          )}
          <TextField
            label={label(t("reportBug.field.essence"), "essence")}
            value={form.essence}
            onChange={(event) => change("essence", event.target.value)}
            size="small"
            fullWidth
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Box
                    component="span"
                    sx={{
                      fontFamily: tokens.mono,
                      fontSize: 11.5,
                      bgcolor: tokens.subtle,
                      borderRadius: 1,
                      px: 0.75,
                      py: 0.25,
                      color: tokens.textMuted,
                    }}
                  >
                    {prep?.prefix ?? "[Automation]"}
                  </Box>
                </InputAdornment>
              ),
            }}
            inputProps={{ "data-testid": "bugField-essence", maxLength: 200 }}
          />
          {textField("environment", t("reportBug.field.environment"), 2)}
          {textField(
            "steps",
            t("reportBug.field.steps"),
            2,
            t("reportBug.stepsPlaceholder"),
          )}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
              gap: 1.5,
            }}
          >
            {textField("actual", t("reportBug.field.actual"), 3)}
            {textField("expected", t("reportBug.field.expected"), 3)}
          </Box>
          <Typography variant="caption" color="textSecondary" sx={{ mt: -1 }}>
            {prep && !prep.hasBaseline
              ? t("reportBug.screenshotsNoBaseline")
              : t("reportBug.screenshots")}
          </Typography>
          {visibleInputs(inputs).map((input) => (
            <JiraFieldInput
              key={`${issueTypeId}-${input.id}`}
              testRunId={testRun.id}
              input={input}
              chosen={valueOf(input)}
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
          {cannotAsk.length > 0 && prep && (
            <Alert severity="warning">
              {t("bug.cannotAsk", {
                fields: cannotAsk.join(", "),
                key: prep.parent.key,
              })}
            </Alert>
          )}
          <Typography variant="caption" color="textSecondary">
            {t("reportBug.visionAdds")}
          </Typography>
        </Box>
      </Box>
      <Box
        sx={{
          minHeight: 60,
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          px: 2,
          borderTop: `1px solid ${tokens.border}`,
          flexShrink: 0,
          // one line: Create bug used to drop under the list of missing fields
          "& > *": { flexShrink: 0 },
        }}
      >
        {canReject && (
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={reject}
                onChange={(event) => setReject(event.target.checked)}
                data-testid="alsoReject"
              />
            }
            label={
              <Typography variant="body2">
                {t("reportBug.alsoReject")}
              </Typography>
            }
          />
        )}
        {/* what is left to fill in, quietly: in red before anything was typed it
            read as an error; the full list is in the tooltip when cut short */}
        <Box
          sx={{
            flex: "1 1 0 !important",
            minWidth: 0,
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          {prep && missingNames.length > 0 && (
            <Tooltip title={missingNames.join(", ")}>
              <Typography
                variant="body2"
                noWrap
                sx={{ color: tokens.textSecondary }}
                data-testid="bugMissing"
              >
                {t("reportBug.missing", {
                  count: missingNames.length,
                  fields: missingNames.join(", "),
                })}
              </Typography>
            </Tooltip>
          )}
        </Box>
        <Button onClick={onClose} disabled={creating}>
          {t("common.cancel")}
        </Button>
        <Button
          variant="contained"
          onClick={create}
          disabled={!ready}
          data-testid="createBug"
        >
          {creating ? t("reportBug.creating") : t("bug.create")}
        </Button>
      </Box>
    </Dialog>
  );
};
