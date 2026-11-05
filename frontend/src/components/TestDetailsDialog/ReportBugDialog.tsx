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
  InfoOutlined,
  Refresh,
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
import { LabelledField } from "./LabelledField";
import { describeChange } from "../ChangeGroups";
import { tokens, type, radius } from "../../theme";
import { useT } from "../../i18n";
import { DeviceTags } from "../DeviceTags";
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
  missingTargets,
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
  // the person pressed Create bug with something empty: show what is required
  const [tried, setTried] = React.useState(false);
  const formRef = React.useRef<HTMLDivElement>(null);
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
  const targets = missingTargets(
    !!prep && !!issueType,
    missing,
    inputs,
    cannotAsk.length,
  );
  const isRequired = (target: string) => tried && targets.includes(target);

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

  // the first empty field comes into view and takes the focus (REQ-046-41)
  const reveal = (target: string) =>
    window.requestAnimationFrame(() => {
      const box = formRef.current?.querySelector<HTMLElement>(
        `[data-bug-field="${target}"]`,
      );
      if (!box) return;
      const reduce = window.matchMedia?.(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      box.scrollIntoView({
        block: "center",
        behavior: reduce ? "auto" : "smooth",
      });
      box
        .querySelector<HTMLElement>(
          'textarea:not([aria-hidden]), input:not([aria-hidden="true"]):not([type="hidden"]), [role="combobox"]',
        )
        ?.focus({ preventScroll: true });
    });

  const create = async () => {
    if (creating || drafting || loading) return;
    if (targets.length) {
      setTried(true);
      reveal(targets[0]);
      return;
    }
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

  const textField = (
    field: DraftField | "environment",
    text: string,
    rows: number,
    options: { placeholder?: string; helper?: React.ReactNode } = {},
  ) => {
    const ai = field !== "environment" && drafted.has(field);
    return (
      <LabelledField
        id={`bug-${field}`}
        label={text}
        ai={ai}
        aiTestId={`aiDrafted-${field}`}
        helper={options.helper}
        required={isRequired(field)}
        target={field}
      >
        <TextField
          id={`bug-${field}`}
          value={form[field]}
          onChange={(event) => change(field, event.target.value)}
          multiline
          minRows={rows}
          maxRows={rows + 3}
          placeholder={options.placeholder}
          error={
            field !== "environment" &&
            missing.texts.includes(field) &&
            (tried || edited.has(field))
          }
          inputProps={{ "data-testid": `bugField-${field}` }}
          fullWidth
          size="small"
        />
      </LabelledField>
    );
  };

  const aiGets = t("reportBug.aiGets", {
    areas: Math.min(3, marks.length || (structure?.regions.length ?? 0)),
    changes: tickedChanges.length,
  });

  return (
    <Dialog
      open
      onClose={creating ? undefined : onClose}
      maxWidth={false}
      PaperProps={{
        sx: {
          width: "min(1120px, calc(100vw - 32px))",
          height: "min(780px, calc(100vh - 32px))",
          display: "flex",
          flexDirection: "column",
        },
      }}
      data-testid="reportBugDialog"
    >
      <Box
        sx={{
          height: 60,
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          pl: 3,
          pr: 2,
          borderBottom: `1px solid ${tokens.border}`,
          flexShrink: 0,
        }}
      >
        <BugReport sx={{ color: tokens.brand, fontSize: 20 }} />
        <Typography variant="h6" sx={{ fontSize: type.title, fontWeight: 600 }}>
          {t("reportBug.title")}
        </Typography>
        <Typography
          variant="body2"
          noWrap
          sx={{ minWidth: 0, flexShrink: 1, color: tokens.textSecondary }}
        >
          {testRun.name}
        </Typography>
        <DeviceTags
          parts={{ os: testRun.os, device: testRun.device }}
          sx={{ flexWrap: "nowrap", flexShrink: 0 }}
        />
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
          gridTemplateColumns: { xs: "1fr", md: "380px minmax(0, 1fr)" },
          overflow: { xs: "auto", md: "hidden" },
        }}
      >
        <Box
          sx={{
            background: tokens.lightbox,
            borderRight: { md: `1px solid ${tokens.border}` },
            px: 3,
            py: 2.5,
            overflow: "auto",
          }}
        >
          <BugEvidence
            testRun={testRun}
            marks={marks}
            onChange={setMarks}
            elements={structure?.elements ?? []}
            disabled={drafting || creating}
            width={332}
            height={460}
          />
        </Box>
        <Box
          ref={formRef}
          sx={{
            px: 3.5,
            py: 2.5,
            display: "flex",
            flexDirection: "column",
            gap: 2,
            overflow: "auto",
            minWidth: 0,
          }}
        >
          <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
            <LabelledField
              id="bug-parent"
              label={t("bug.task")}
              required={isRequired("parent")}
              target="parent"
              helper={
                parentKey && !keyValid
                  ? t("bug.looksLike")
                  : prep
                    ? `${prep.parent.summary}${prep.parent.assignee ? ` — ${prep.parent.assignee}` : ""}`
                    : t("bug.taskHelp")
              }
              sx={{ flex: "1 1 200px" }}
            >
              <TextField
                id="bug-parent"
                placeholder="P24MOB-14136"
                value={parentKey}
                onChange={(event) => setParentKey(event.target.value)}
                error={(!!parentKey && !keyValid) || isRequired("parent")}
                size="small"
                inputProps={{ style: { fontFamily: tokens.mono } }}
              />
            </LabelledField>
            {prep && (
              <LabelledField
                id="bug-issueType"
                label={t("bug.issueType")}
                sx={{ flex: "1 1 180px" }}
              >
                <TextField
                  select
                  id="bug-issueType"
                  value={issueTypeId ?? ""}
                  onChange={(event) => setIssueTypeId(event.target.value)}
                  SelectProps={{ labelId: "bug-issueType-label" }}
                  size="small"
                >
                  {prep.issueTypes.map((type) => (
                    <MenuItem key={type.id} value={type.id}>
                      {type.name}
                      {type.subtask ? t("bug.subtask") : ""}
                    </MenuItem>
                  ))}
                </TextField>
              </LabelledField>
            )}
            {prep &&
              issueType &&
              !issueType.subtask &&
              prep.linkTypes.length > 0 && (
                <LabelledField
                  id="bug-linkType"
                  label={t("bug.linkAs")}
                  sx={{ flex: "1 1 160px" }}
                >
                  <TextField
                    select
                    id="bug-linkType"
                    value={linkType ?? ""}
                    onChange={(event) => setLinkType(event.target.value)}
                    SelectProps={{ labelId: "bug-linkType-label" }}
                    size="small"
                  >
                    {prep.linkTypes.map((name) => (
                      <MenuItem key={name} value={name}>
                        {name}
                      </MenuItem>
                    ))}
                  </TextField>
                </LabelledField>
              )}
          </Box>
          {loading && <LinearProgress />}
          {error && <Alert severity="error">{error}</Alert>}
          {withAi && (
            <Box
              sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}
              data-testid="bugAi"
            >
              <LabelledField id="bug-note" label={t("reportBug.note")}>
                <TextField
                  id="bug-note"
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
              </LabelledField>
              <Box
                sx={{
                  display: "flex",
                  gap: 0.75,
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <Typography
                  sx={{ fontSize: type.caption, color: tokens.textMuted }}
                >
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
                  <Typography
                    sx={{ fontSize: type.caption, color: tokens.textMuted }}
                  >
                    {t("reportBug.changesItLooksAt")}
                  </Typography>
                  {changes.map((option) => (
                    <FormControlLabel
                      key={option.key}
                      sx={{
                        display: "flex",
                        ml: 0,
                        "& .MuiFormControlLabel-label": {
                          fontSize: type.small,
                        },
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
              {/* asking AI is a side step: Create bug stays the one main action (REQ-046-40) */}
              <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
                {attempt > 0 && (
                  <Typography
                    sx={{
                      fontSize: type.small,
                      color: tokens.textSecondary,
                      minWidth: 0,
                    }}
                    data-testid="aiDraftedNote"
                  >
                    {t("reportBug.drafted")}
                  </Typography>
                )}
                <Button
                  variant="outlined"
                  size="small"
                  color="inherit"
                  startIcon={attempt ? <Refresh /> : <AutoAwesome />}
                  onClick={askAi}
                  disabled={!canAskAi(note) || drafting || creating}
                  data-testid="fillWithAi"
                  sx={{
                    ml: attempt ? "auto" : 0,
                    flexShrink: 0,
                    borderColor: tokens.borderStrong,
                    fontWeight: 600,
                  }}
                >
                  {drafting
                    ? t("reportBug.drafting")
                    : attempt
                      ? t("reportBug.draftAgain")
                      : t("reportBug.fillWithAi")}
                </Button>
                <Tooltip title={aiGets}>
                  <IconButton
                    size="small"
                    aria-label={t("reportBug.whatAiGets")}
                    data-testid="aiGetsInfo"
                    sx={{ color: tokens.textMuted, flexShrink: 0 }}
                  >
                    <InfoOutlined sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
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
          <LabelledField
            id="bug-essence"
            label={t("reportBug.field.essence")}
            ai={drafted.has("essence")}
            aiTestId="aiDrafted-essence"
            required={isRequired("essence")}
            target="essence"
          >
            <TextField
              id="bug-essence"
              value={form.essence}
              onChange={(event) => change("essence", event.target.value)}
              error={
                missing.texts.includes("essence") &&
                (tried || edited.has("essence"))
              }
              size="small"
              fullWidth
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Box
                      component="span"
                      sx={{
                        fontFamily: tokens.mono,
                        fontSize: type.caption,
                        bgcolor: tokens.subtle,
                        borderRadius: radius.control,
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
              inputProps={{
                "data-testid": "bugField-essence",
                maxLength: 200,
              }}
            />
          </LabelledField>
          {textField("environment", t("reportBug.field.environment"), 2)}
          {textField("steps", t("reportBug.field.steps"), 2, {
            placeholder: t("reportBug.stepsPlaceholder"),
          })}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(2, minmax(0, 1fr))",
              },
              gap: 2,
            }}
          >
            {textField("actual", t("reportBug.field.actual"), 3, {
              helper: t("reportBug.getsCurrent"),
            })}
            {textField("expected", t("reportBug.field.expected"), 3, {
              helper:
                prep && !prep.hasBaseline
                  ? t("reportBug.noBaseline")
                  : t("reportBug.getsBaseline"),
            })}
          </Box>
          {visibleInputs(inputs).map((input) => (
            // Jira's own name, as Jira shows it; only the caption is ours (REQ-046-43)
            <LabelledField
              key={`${issueTypeId}-${input.id}`}
              id={`bug-jira-${input.id}`}
              label={input.name}
              caption={t("reportBug.jiraField")}
              required={isRequired(`jira:${input.id}`)}
              target={`jira:${input.id}`}
            >
              <JiraFieldInput
                id={`bug-jira-${input.id}`}
                testRunId={testRun.id}
                input={input}
                chosen={valueOf(input)}
                error={isRequired(`jira:${input.id}`)}
                onChange={(value) =>
                  setChosen((current) => {
                    const next = { ...current };
                    if (value) next[input.id] = value;
                    else delete next[input.id];
                    return next;
                  })
                }
              />
            </LabelledField>
          ))}
          {cannotAsk.length > 0 && prep && (
            <Alert severity="warning" data-bug-field="cannotAsk">
              {t("bug.cannotAsk", {
                fields: cannotAsk.join(", "),
                key: prep.parent.key,
              })}
            </Alert>
          )}
        </Box>
      </Box>
      <Box
        sx={{
          minHeight: 68,
          display: "flex",
          alignItems: "center",
          gap: 2,
          px: 3,
          borderTop: `1px solid ${tokens.border}`,
          flexShrink: 0,
        }}
      >
        {canReject && (
          <FormControlLabel
            sx={{ flexShrink: 0, mr: 0 }}
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
        <Tooltip title={t("reportBug.visionAdds")}>
          <Typography
            noWrap
            sx={{
              ml: "auto",
              minWidth: 0,
              fontSize: type.small,
              color: tokens.textMuted,
            }}
            data-testid="bugAdds"
          >
            {t("reportBug.adds")}
          </Typography>
        </Tooltip>
        <Button
          onClick={onClose}
          disabled={creating}
          sx={{ flexShrink: 0, color: tokens.textSecondary }}
        >
          {t("common.cancel")}
        </Button>
        <Button
          variant="contained"
          onClick={create}
          disabled={creating}
          data-testid="createBug"
          sx={{ flexShrink: 0 }}
        >
          {creating ? t("reportBug.creating") : t("bug.create")}
        </Button>
      </Box>
    </Dialog>
  );
};
