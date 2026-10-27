import React from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  MenuItem,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { MessageKey, useT } from "../../i18n";
import {
  A11yRule,
  ClassConditions,
  DEFAULT_DUPLICATE_MODES,
  DuplicateMode,
  GroupBy,
  ProblemClass,
} from "../../types/insights";
import { tokens } from "../../theme";
import { SettingRow, SettingSection } from "./SettingRow";
import { DEFAULT_SCREEN_TITLE } from "./defaults";
import {
  CONDITION_FIELDS,
  ConditionField,
  classCoverage,
  conditionSuggestions,
  lines,
  patternError,
} from "./patterns";
import { useFieldError, useProjectDraft } from "./useProjectDraft";
import { hasSuggestions, useVocabulary } from "./vocabulary";

export const A11Y_RULES: A11yRule[] = [
  "touch-target",
  "low-contrast",
  "missing-label",
  "input-without-label",
  "duplicate-label",
  "redundant-role",
  "not-accessible",
];

const ruleLabel = (rule: A11yRule) => `a11y.rule.${rule}` as MessageKey;

const MODES: Array<[DuplicateMode, MessageKey, MessageKey, MessageKey]> = [
  [
    "component-value",
    "a11y.mode.componentValue",
    "a11y.mode.componentValueSame",
    "a11y.mode.componentValueDifferent",
  ],
  [
    "component",
    "a11y.mode.component",
    "a11y.mode.componentSame",
    "a11y.mode.componentDifferent",
  ],
  [
    "screen",
    "a11y.mode.screen",
    "a11y.mode.screenSame",
    "a11y.mode.screenDifferent",
  ],
];

const FIELD_LABELS: Record<ConditionField, [MessageKey, string]> = {
  element: ["a11y.field.element", "*#PbButton, /^.*:id\\/(tab)_\\d+$/"],
  screen: ["a11y.field.screen", "Онбординг*"],
  className: ["a11y.field.className", "*ImageButton"],
  label: ["a11y.field.label", "/^Закрити$/"],
};

const modeLabel = (groupBy: GroupBy): MessageKey =>
  groupBy === "class"
    ? "a11y.mode.class"
    : (MODES.find(([value]) => value === groupBy)?.[1] ??
      "a11y.mode.component");

/** The conditions of a class, reading classes written with a single element pattern too. */
const conditionsOf = (item: ProblemClass): ClassConditions => ({
  ...item.when,
  ...(!item.when?.element?.length && item.match
    ? { element: [item.match] }
    : {}),
});

export const AccessibilityTab: React.FunctionComponent = () => {
  const { t } = useT();
  const { vocabulary, loading } = useVocabulary();
  return (
    <>
      <Alert severity="info" variant="outlined">
        {t("a11y.intro")}
      </Alert>
      {!loading && !hasSuggestions(vocabulary) && (
        <Alert severity="info">{t("settings.noSuggestions")}</Alert>
      )}
      <ScreenTitle />
      <SameProblem />
      <ProblemClasses />
    </>
  );
};

const ScreenTitle = () => {
  const { t } = useT();
  const { settings, updateSettings } = useProjectDraft();
  const { vocabulary } = useVocabulary();
  const current = settings.screenTitle?.length
    ? settings.screenTitle
    : DEFAULT_SCREEN_TITLE;
  const [text, setText] = React.useState(current.join("\n"));
  const error = useFieldError("screenTitleSelectors");
  const isDefault = current.join("\n") === DEFAULT_SCREEN_TITLE.join("\n");

  // follow a pick or a reset made outside the text field
  React.useEffect(() => {
    if (lines(text).join("\n") !== current.join("\n")) {
      setText(current.join("\n"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.join("\n")]);

  const commit = (value: string) => {
    const selectors = lines(value);
    updateSettings({
      screenTitle: selectors.length ? selectors : DEFAULT_SCREEN_TITLE,
    });
  };
  const candidates = vocabulary?.titleCandidates ?? [];

  return (
    <SettingSection
      title={t("a11y.screenTitle")}
      intro={t("a11y.screenTitleIntro")}
      testId="screenTitle"
    >
      {candidates.length > 0 && (
        <Box sx={{ display: "grid", gap: 1, py: 1.5 }}>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {t("a11y.titleFound", { count: vocabulary?.trees ?? 0 })}
          </Typography>
          {candidates.map((candidate) => {
            const used = current[0] === candidate.selector;
            return (
              <Box
                key={candidate.selector}
                data-testid="titleCandidate"
                sx={{
                  border: `1px solid ${used ? tokens.brand : tokens.border}`,
                  borderRadius: 2,
                  px: 1.5,
                  py: 1,
                  display: "flex",
                  gap: 2,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <Box sx={{ flex: "1 1 260px", minWidth: 0 }}>
                  <Typography
                    component="code"
                    sx={{ fontFamily: tokens.mono, fontSize: 13 }}
                  >
                    {candidate.selector}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="textSecondary"
                    component="div"
                  >
                    {t("a11y.titleCoverage", {
                      count: candidate.screens,
                      total: vocabulary?.trees ?? 0,
                    })}
                  </Typography>
                  <Box
                    sx={{
                      display: "flex",
                      gap: 0.5,
                      flexWrap: "wrap",
                      mt: 0.5,
                    }}
                  >
                    {candidate.examples.map((example) => (
                      <Chip
                        key={example}
                        size="small"
                        label={example}
                        sx={{ height: 20, fontSize: 11 }}
                      />
                    ))}
                  </Box>
                </Box>
                <Button
                  size="small"
                  variant={used ? "text" : "outlined"}
                  disabled={used}
                  onClick={() =>
                    updateSettings({
                      screenTitle: [
                        candidate.selector,
                        ...current.filter(
                          (item) => item !== candidate.selector,
                        ),
                      ],
                    })
                  }
                >
                  {used ? t("a11y.titleUsed") : t("a11y.titleUse")}
                </Button>
              </Box>
            );
          })}
        </Box>
      )}
      <SettingRow
        label={t("a11y.titleSelectors")}
        help={t("a11y.titleSelectorsHelp")}
        defaultText={DEFAULT_SCREEN_TITLE.join(", ")}
        changed={!isDefault}
        onReset={() => updateSettings({ screenTitle: DEFAULT_SCREEN_TITLE })}
        wide
      >
        <TextField
          id="screenTitleSelectors"
          size="small"
          multiline
          minRows={2}
          fullWidth
          inputProps={{ "aria-label": t("a11y.titleSelectors") }}
          value={text}
          error={!!error}
          helperText={error}
          onChange={(event) => setText(event.target.value)}
          onBlur={() => commit(text)}
        />
      </SettingRow>
    </SettingSection>
  );
};

const SameProblem = () => {
  const { t } = useT();
  const { settings, updateSettings } = useProjectDraft();

  return (
    <SettingSection
      title={t("a11y.sameProblem")}
      intro={t("a11y.sameProblemIntro")}
      testId="sameProblem"
    >
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
          gap: 1.5,
          py: 1.5,
        }}
      >
        {MODES.map(([mode, label, same, different]) => (
          <Box
            key={mode}
            sx={{
              border: `1px solid ${tokens.border}`,
              borderRadius: 2,
              p: 1.5,
            }}
          >
            <Typography sx={{ fontWeight: 500, mb: 0.5 }}>
              {t(label)}
            </Typography>
            <Typography variant="body2" component="div">
              <Box component="span" sx={{ color: tokens.status.passed.fg }}>
                ✓{" "}
              </Box>
              {t(same)}
            </Typography>
            <Typography
              variant="body2"
              component="div"
              color="textSecondary"
              sx={{ mt: 0.5 }}
            >
              ≠ {t(different)}
            </Typography>
          </Box>
        ))}
      </Box>
      {A11Y_RULES.map((rule) => {
        const fallback = DEFAULT_DUPLICATE_MODES[rule];
        const value = settings.a11yDuplicates?.[rule] ?? fallback;
        return (
          <SettingRow
            key={rule}
            label={t(ruleLabel(rule))}
            defaultText={t(modeLabel(fallback))}
            changed={value !== fallback}
            onReset={() =>
              updateSettings({
                a11yDuplicates: {
                  ...settings.a11yDuplicates,
                  [rule]: fallback,
                },
              })
            }
          >
            <TextField
              select
              size="small"
              sx={{ width: 340, maxWidth: "100%" }}
              inputProps={{
                "aria-label": t("a11y.sameProblemFor", {
                  rule: t(ruleLabel(rule)),
                }),
              }}
              value={value}
              onChange={(event) =>
                updateSettings({
                  a11yDuplicates: {
                    ...settings.a11yDuplicates,
                    [rule]: event.target.value as DuplicateMode,
                  },
                })
              }
            >
              {MODES.map(([mode, label]) => (
                <MenuItem key={mode} value={mode}>
                  {t(label)}
                </MenuItem>
              ))}
            </TextField>
          </SettingRow>
        );
      })}
    </SettingSection>
  );
};

type Draft = {
  name: string;
  rules: A11yRule[];
  conditions: Record<ConditionField, string[]>;
  groupBy: GroupBy | "";
  action: "report" | "ignore";
};

const emptyDraft = (): Draft => ({
  name: "",
  rules: [],
  conditions: { element: [], screen: [], className: [], label: [] },
  groupBy: "",
  action: "report",
});

const ProblemClasses = () => {
  const { t } = useT();
  const { settings, updateSettings } = useProjectDraft();
  const { vocabulary } = useVocabulary();
  const classes = settings.a11yClasses ?? [];
  const [draft, setDraft] = React.useState(emptyDraft);
  const errors = CONDITION_FIELDS.map((field) =>
    draft.conditions[field].map(patternError).find(Boolean),
  );
  const hasCondition = CONDITION_FIELDS.some(
    (field) => draft.conditions[field].length > 0,
  );
  const coverage =
    vocabulary && hasCondition && !errors.some(Boolean)
      ? classCoverage(draft.conditions, vocabulary)
      : null;

  const addClass = () => {
    const when = Object.fromEntries(
      CONDITION_FIELDS.map((field) => [field, draft.conditions[field]]).filter(
        ([, list]) => list.length,
      ),
    ) as ClassConditions;
    const added: ProblemClass = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      name:
        draft.name.trim() ||
        Object.values(when).flat().join(" · ").slice(0, 60),
      when,
      ...(draft.rules.length ? { rules: draft.rules } : {}),
      ...(draft.groupBy ? { groupBy: draft.groupBy } : {}),
      action: draft.action,
    };
    updateSettings({ a11yClasses: [...classes, added] });
    setDraft(emptyDraft());
  };

  const move = (index: number, by: number) => {
    const next = [...classes];
    const [item] = next.splice(index, 1);
    next.splice(index + by, 0, item);
    updateSettings({ a11yClasses: next });
  };

  return (
    <SettingSection
      title={t("a11y.classes")}
      intro={t("a11y.classesIntro")}
      testId="a11yProblemSettings"
    >
      {classes.map((item, index) => (
        <ClassRow
          key={item.id}
          item={item}
          first={index === 0}
          onUp={() => move(index, -1)}
          onRemove={() =>
            updateSettings({
              a11yClasses: classes.filter((other) => other.id !== item.id),
            })
          }
        />
      ))}
      {!classes.length && (
        <Typography variant="body2" color="textSecondary" sx={{ py: 1 }}>
          {t("a11y.noClasses")}
        </Typography>
      )}

      <Box
        sx={{
          mt: 2,
          p: 2,
          border: `1px dashed ${tokens.border}`,
          borderRadius: 2,
          display: "grid",
          gap: 1.5,
        }}
        data-testid="newProblemClass"
      >
        <Typography sx={{ fontWeight: 500 }}>{t("a11y.newClass")}</Typography>
        <TextField
          id="problemClassName"
          size="small"
          label={t("a11y.className")}
          placeholder={t("a11y.classNamePlaceholder")}
          value={draft.name}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
        />
        <Typography variant="body2" color="textSecondary">
          {t("a11y.conditionsHelp")} {t("a11y.patternHelp")}
        </Typography>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            gap: 1.5,
          }}
        >
          {CONDITION_FIELDS.map((field, index) => (
            <ConditionInput
              key={field}
              field={field}
              value={draft.conditions[field]}
              error={errors[index] ?? undefined}
              onChange={(value) =>
                setDraft({
                  ...draft,
                  conditions: { ...draft.conditions, [field]: value },
                })
              }
            />
          ))}
        </Box>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            gap: 1.5,
          }}
        >
          <TextField
            id="problemClassRules"
            size="small"
            select
            label={t("a11y.classRules")}
            SelectProps={{
              multiple: true,
              displayEmpty: true,
              renderValue: (value) =>
                (value as A11yRule[]).length
                  ? (value as A11yRule[])
                      .map((rule) => t(ruleLabel(rule)))
                      .join(", ")
                  : t("a11y.everyRule"),
            }}
            InputLabelProps={{ shrink: true }}
            value={draft.rules}
            onChange={(event) =>
              setDraft({
                ...draft,
                rules: ([] as string[]).concat(
                  event.target.value as string | string[],
                ) as A11yRule[],
              })
            }
          >
            {A11Y_RULES.map((rule) => (
              <MenuItem key={rule} value={rule}>
                {t(ruleLabel(rule))}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            id="problemClassGroupBy"
            size="small"
            select
            label={t("a11y.classGroupBy")}
            SelectProps={{ displayEmpty: true }}
            InputLabelProps={{ shrink: true }}
            value={draft.groupBy}
            onChange={(event) =>
              setDraft({
                ...draft,
                groupBy: event.target.value as GroupBy | "",
              })
            }
          >
            <MenuItem value="">{t("a11y.mode.rule")}</MenuItem>
            {MODES.map(([mode, label]) => (
              <MenuItem key={mode} value={mode}>
                {t(label)}
              </MenuItem>
            ))}
            <MenuItem value="class">{t("a11y.mode.class")}</MenuItem>
          </TextField>
        </Box>
        <Box
          sx={{
            display: "flex",
            gap: 1.5,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <ToggleButtonGroup
            exclusive
            size="small"
            value={draft.action}
            aria-label={t("a11y.classAction")}
            onChange={(_, next: Draft["action"] | null) =>
              next && setDraft({ ...draft, action: next })
            }
          >
            <ToggleButton value="report">{t("a11y.fileBugs")}</ToggleButton>
            <ToggleButton value="ignore">{t("a11y.ignore")}</ToggleButton>
          </ToggleButtonGroup>
          <Typography variant="body2" color="textSecondary" sx={{ flex: 1 }}>
            {t(
              draft.action === "ignore"
                ? "a11y.ignoreHelp"
                : "a11y.fileBugsHelp",
            )}
          </Typography>
        </Box>
        {coverage && (
          <Alert
            severity={coverage.elements ? "success" : "warning"}
            data-testid="classCoverage"
          >
            {coverage.elements
              ? t("a11y.coverage", {
                  count: coverage.elements,
                  screens: coverage.screens,
                })
              : t("a11y.coverageNone")}
            {coverage.examples.length > 0 && (
              <Box
                component="div"
                sx={{ fontFamily: tokens.mono, fontSize: 12, mt: 0.5 }}
              >
                {coverage.examples.join(", ")}
              </Box>
            )}
          </Alert>
        )}
        <Box>
          <Button
            variant="outlined"
            disabled={!hasCondition || errors.some(Boolean)}
            onClick={addClass}
          >
            {t("a11y.addClass")}
          </Button>
        </Box>
      </Box>
    </SettingSection>
  );
};

const ConditionInput: React.FunctionComponent<{
  field: ConditionField;
  value: string[];
  error?: string;
  onChange: (value: string[]) => void;
}> = ({ field, value, error, onChange }) => {
  const { t } = useT();
  const { vocabulary } = useVocabulary();
  const [query, setQuery] = React.useState("");
  const [label, placeholder] = FIELD_LABELS[field];
  const options = React.useMemo(
    () => (vocabulary ? conditionSuggestions(field, vocabulary, query) : []),
    [vocabulary, field, query],
  );

  return (
    <Autocomplete
      id={`problemClass-${field}`}
      multiple
      freeSolo
      size="small"
      options={options}
      filterOptions={(items) => items}
      value={value}
      inputValue={query}
      onInputChange={(_, next) => setQuery(next)}
      onChange={(_, next) =>
        onChange((next as string[]).map((item) => item.trim()).filter(Boolean))
      }
      // a pattern typed and left without Enter still counts
      onBlur={() => {
        if (query.trim()) {
          onChange([...value, query.trim()]);
          setQuery("");
        }
      }}
      renderTags={(items, getTagProps) =>
        items.map((item, index) => (
          // eslint-disable-next-line react/jsx-key
          <Chip
            size="small"
            label={item}
            sx={{ fontFamily: tokens.mono, fontSize: 12 }}
            {...getTagProps({ index })}
          />
        ))
      }
      renderInput={(params) => (
        <TextField
          {...params}
          label={t(label)}
          placeholder={value.length ? "" : placeholder}
          error={!!error}
          helperText={error}
        />
      )}
    />
  );
};

const ClassRow: React.FunctionComponent<{
  item: ProblemClass;
  first: boolean;
  onUp: () => void;
  onRemove: () => void;
}> = ({ item, first, onUp, onRemove }) => {
  const { t } = useT();
  const { vocabulary } = useVocabulary();
  const error = useFieldError(`class-${item.id}`);
  const when = conditionsOf(item);
  const groupBy = item.groupBy ?? item.mode;
  const coverage =
    vocabulary && hasSuggestions(vocabulary) && !error
      ? classCoverage(when, vocabulary)
      : null;

  return (
    <Box
      id={`class-${item.id}`}
      tabIndex={-1}
      data-testid="a11yProblemClass"
      sx={{
        display: "flex",
        alignItems: "flex-start",
        gap: 1,
        flexWrap: "wrap",
        borderBottom: `1px solid ${tokens.border}`,
        py: 1,
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          {item.name}
        </Typography>
        {CONDITION_FIELDS.filter((field) => when[field]?.length).map(
          (field) => (
            <Typography
              key={field}
              variant="caption"
              color="textSecondary"
              component="div"
            >
              {t(FIELD_LABELS[field][0])}:{" "}
              <code style={{ fontSize: 12 }}>{when[field]?.join("  |  ")}</code>
            </Typography>
          ),
        )}
        <Typography variant="caption" color="textSecondary" component="div">
          {item.rules?.length
            ? item.rules.map((rule) => t(ruleLabel(rule))).join(", ")
            : t("a11y.everyRule")}{" "}
          ·{" "}
          {item.action === "ignore"
            ? t("a11y.ignored")
            : groupBy
              ? t(modeLabel(groupBy))
              : t("a11y.mode.rule")}
          {coverage &&
            ` · ${t("a11y.coverage", {
              count: coverage.elements,
              screens: coverage.screens,
            })}`}
        </Typography>
        {error && (
          <Typography variant="caption" color="error" component="div">
            {error}
          </Typography>
        )}
      </Box>
      <Box sx={{ display: "flex" }}>
        <Button size="small" disabled={first} onClick={onUp}>
          {t("a11y.up")}
        </Button>
        <Button size="small" onClick={onRemove}>
          {t("common.remove")}
        </Button>
      </Box>
    </Box>
  );
};
