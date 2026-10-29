import React from "react";
import {
  Box,
  Button,
  Divider,
  MenuItem,
  TextField,
  Typography,
} from "@mui/material";
import {
  setProjectEditState,
  useProjectDispatch,
  useProjectState,
} from "../../contexts";
import {
  A11yRule,
  ClassConditions,
  DEFAULT_DUPLICATE_MODES,
  DuplicateMode,
  GroupBy,
  ProblemClass,
  UiTreeSettings,
  parseUiTreeSettings,
} from "../../types/insights";
import { tokens } from "../../theme";
import { MessageKey, Text, useT } from "../../i18n";

const RULES: Array<[A11yRule, MessageKey]> = [
  ["touch-target", "a11y.rule.touchTarget"],
  ["low-contrast", "a11y.rule.lowContrast"],
  ["missing-label", "a11y.rule.missingLabel"],
  ["input-without-label", "a11y.rule.inputWithoutLabel"],
  ["duplicate-label", "a11y.rule.duplicateLabel"],
  ["redundant-role", "a11y.rule.redundantRole"],
  ["not-accessible", "a11y.rule.notAccessible"],
];

const MODES: Array<[DuplicateMode, MessageKey]> = [
  ["component-value", "a11y.mode.componentValue"],
  ["component", "a11y.mode.component"],
  ["screen", "a11y.mode.screen"],
];

/** The same check as the server's: a /regex/ must compile; a glob always does. */
const patternError = (pattern: string, t: Text): string | null => {
  const regex = /^\/(.+)\/([a-z]*)$/s.exec(pattern.trim());
  if (!pattern.trim()) return t("a11y.required");
  if (!regex) return null;
  try {
    new RegExp(regex[1], regex[2].replace(/[^imsu]/g, ""));
    return null;
  } catch (error) {
    return `${error}`;
  }
};

type Field = keyof ClassConditions;

// the placeholders are patterns, the same in every language
const FIELDS: Array<[Field, MessageKey, string]> = [
  ["element", "a11y.field.element", "*#PbButton or /^.*:id\\/(tab)_\\d+$/"],
  ["screen", "a11y.field.screen", "Онбординг*"],
  ["className", "a11y.field.className", "*ImageButton"],
  ["label", "a11y.field.label", "/^Закрити$/"],
];

const GROUPINGS: Array<[GroupBy, MessageKey]> = [
  ...MODES,
  ["class", "a11y.mode.class"],
];

const groupingLabel = (groupBy: GroupBy, t: Text) => {
  const key = GROUPINGS.find(([value]) => value === groupBy)?.[1];
  return key ? t(key) : groupBy;
};

/** The conditions of a class, reading classes written with a single element pattern too. */
const conditionsOf = (item: ProblemClass): ClassConditions => ({
  ...item.when,
  ...(!item.when?.element?.length && item.match
    ? { element: [item.match] }
    : {}),
});

const lines = (text: string) =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

type Draft = {
  name: string;
  rules: A11yRule[];
  conditions: Record<Field, string>;
  groupBy: GroupBy | "";
  action: "report" | "ignore";
};

const emptyDraft = (): Draft => ({
  name: "",
  rules: [],
  conditions: { element: "", screen: "", className: "", label: "" },
  groupBy: "",
  action: "report",
});

/**
 * How accessibility issues become problems, so one bug covers one problem:
 * where the screen title is, when two issues are the same problem per rule,
 * and the project's problem classes, matched by a pattern on the element id.
 */
export const A11yProblemSettings: React.FunctionComponent<{
  // on the settings page the section card carries the heading
  bare?: boolean;
}> = ({ bare = false }) => {
  const { projectEditState: project } = useProjectState();
  const projectDispatch = useProjectDispatch();
  const { t, tx, formatOrdinal } = useT();
  const settings = parseUiTreeSettings(project.uiTreeSettings);
  const classes = settings.a11yClasses ?? [];
  const [titleText, setTitleText] = React.useState(
    (settings.screenTitle ?? ["id:Appbar#Title"]).join("\n"),
  );
  const [draft, setDraft] = React.useState(emptyDraft);
  const draftErrors = FIELDS.map(([field]) =>
    lines(draft.conditions[field])
      .map((pattern) => patternError(pattern, t))
      .find((error) => error),
  );
  const hasCondition = FIELDS.some(
    ([field]) => lines(draft.conditions[field]).length > 0,
  );

  const save = (next: UiTreeSettings) =>
    setProjectEditState(projectDispatch, {
      ...project,
      uiTreeSettings: JSON.stringify(next),
    });

  const addClass = () => {
    const when = Object.fromEntries(
      FIELDS.map(([field]) => [field, lines(draft.conditions[field])]).filter(
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
    save({ ...settings, a11yClasses: [...classes, added] });
    setDraft(emptyDraft());
  };

  const move = (index: number, by: number) => {
    const next = [...classes];
    const [item] = next.splice(index, 1);
    next.splice(index + by, 0, item);
    save({ ...settings, a11yClasses: next });
  };

  return (
    <Box
      sx={{
        mt: bare ? 0 : 3,
        display: "flex",
        flexDirection: "column",
        gap: 1,
      }}
      data-testid="a11yProblemSettings"
    >
      {!bare && <Divider />}
      {!bare && <Typography variant="subtitle1">{t("a11y.title")}</Typography>}
      {!bare && (
        <Typography variant="body2" color="textSecondary">
          {t("a11y.intro")}
        </Typography>
      )}

      <TextField
        id="screenTitleSelectors"
        size="small"
        multiline
        minRows={2}
        label={t("a11y.screenTitle")}
        value={titleText}
        onChange={(event) => setTitleText(event.target.value)}
        onBlur={() => {
          const selectors = titleText
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean);
          save({
            ...settings,
            screenTitle: selectors.length ? selectors : ["id:Appbar#Title"],
          });
        }}
        helperText={t("a11y.screenTitleHelp")}
        sx={{ maxWidth: 520 }}
      />

      <Typography variant="body2" sx={{ fontWeight: 600, mt: 1 }}>
        {t("a11y.sameProblem")}
      </Typography>
      <Typography variant="caption" color="textSecondary">
        {t("a11y.sameProblemIntro")}
      </Typography>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 240px",
          gap: 1,
          alignItems: "center",
          maxWidth: 560,
        }}
      >
        {RULES.map(([rule, title]) => (
          <React.Fragment key={rule}>
            <Typography variant="body2">{t(title)}</Typography>
            <TextField
              select
              size="small"
              inputProps={{
                "aria-label": t("a11y.sameProblemFor", { rule: t(title) }),
              }}
              value={
                settings.a11yDuplicates?.[rule] ?? DEFAULT_DUPLICATE_MODES[rule]
              }
              onChange={(event) =>
                save({
                  ...settings,
                  a11yDuplicates: {
                    ...settings.a11yDuplicates,
                    [rule]: event.target.value as DuplicateMode,
                  },
                })
              }
            >
              {MODES.map(([value, label]) => (
                <MenuItem key={value} value={value}>
                  {t(label)}
                </MenuItem>
              ))}
            </TextField>
          </React.Fragment>
        ))}
      </Box>

      <Typography variant="body2" sx={{ fontWeight: 600, mt: 1 }}>
        {t("a11y.classes")}
      </Typography>
      {/* the full explanation is long and read once: it waits behind a toggle */}
      <Box
        component="details"
        data-testid="howMatchingWorks"
        sx={{
          color: tokens.textSecondary,
          fontSize: 12.5,
          "& summary": {
            cursor: "pointer",
            color: tokens.brand,
            fontWeight: 600,
            mb: 0.5,
          },
        }}
      >
        <summary>{t("a11y.howMatching")}</summary>
        <Typography variant="caption" component="p" color="textSecondary">
          {tx("a11y.howMatchingText", {
            example: <code>{"/^.*:id\\/(tab)_\\d+$/"}</code>,
          })}
        </Typography>
      </Box>
      {classes.map((item, index) => {
        const when = conditionsOf(item);
        const groupBy = item.groupBy ?? item.mode;
        return (
          <Box
            key={item.id}
            data-testid="a11yProblemClass"
            sx={{
              display: "flex",
              alignItems: "flex-start",
              gap: 1,
              flexWrap: "wrap",
              borderBottom: `1px solid ${tokens.border}`,
              pb: 0.5,
            }}
          >
            <Box
              aria-label={t("a11y.checkedAt", {
                position: formatOrdinal(index + 1),
              })}
              data-testid="a11yProblemClassNumber"
              sx={{
                width: 24,
                height: 24,
                mt: 0.25,
                borderRadius: 1.5,
                flexShrink: 0,
                display: "grid",
                placeItems: "center",
                fontFamily: tokens.mono,
                fontSize: 11.5,
                fontWeight: 600,
                bgcolor: tokens.subtle,
              }}
            >
              {index + 1}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {item.name}
              </Typography>
              {FIELDS.filter(([field]) => when[field]?.length).map(
                ([field, label]) => (
                  <Typography
                    key={field}
                    variant="caption"
                    color="textSecondary"
                    component="div"
                  >
                    {t(label)}:{" "}
                    <code style={{ fontSize: 12 }}>
                      {when[field]?.join("  |  ")}
                    </code>
                  </Typography>
                ),
              )}
              <Typography variant="caption" color="textSecondary">
                {item.rules?.length
                  ? item.rules.join(", ")
                  : t("a11y.everyRule")}{" "}
                ·{" "}
                {item.action === "ignore"
                  ? t("a11y.ignored")
                  : groupBy
                    ? groupingLabel(groupBy, t)
                    : t("a11y.rulesSetting")}
              </Typography>
            </Box>
            <Box sx={{ display: "flex" }}>
              <Button
                size="small"
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                {t("a11y.up")}
              </Button>
              <Button
                size="small"
                onClick={() =>
                  save({
                    ...settings,
                    a11yClasses: classes.filter(
                      (other) => other.id !== item.id,
                    ),
                  })
                }
              >
                {t("common.remove")}
              </Button>
            </Box>
          </Box>
        );
      })}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 1,
          alignItems: "start",
        }}
      >
        <TextField
          id="problemClassName"
          size="small"
          label={t("a11y.className")}
          value={draft.name}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
        />
        {FIELDS.map(([field, label, placeholder], index) => (
          <TextField
            key={field}
            id={`problemClass-${field}`}
            size="small"
            multiline
            label={t(label)}
            placeholder={placeholder}
            value={draft.conditions[field]}
            onChange={(event) =>
              setDraft({
                ...draft,
                conditions: {
                  ...draft.conditions,
                  [field]: event.target.value,
                },
              })
            }
            error={!!draftErrors[index]}
            helperText={draftErrors[index] ?? t("a11y.patternHelp")}
          />
        ))}
        <TextField
          id="problemClassRules"
          size="small"
          select
          label={t("a11y.classRules")}
          SelectProps={{
            multiple: true,
            renderValue: (value) => (value as string[]).join(", "),
          }}
          value={draft.rules}
          onChange={(event) =>
            setDraft({
              ...draft,
              rules: ([] as string[]).concat(
                event.target.value as string | string[],
              ) as A11yRule[],
            })
          }
          helperText={t("a11y.classRulesHelp")}
        >
          {RULES.map(([rule, title]) => (
            <MenuItem key={rule} value={rule}>
              {t(title)}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          id="problemClassGroupBy"
          size="small"
          select
          label={t("a11y.sameProblem")}
          value={draft.groupBy}
          onChange={(event) =>
            setDraft({ ...draft, groupBy: event.target.value as GroupBy | "" })
          }
        >
          <MenuItem value="">{t("a11y.classRuleSetting")}</MenuItem>
          {GROUPINGS.map(([value, label]) => (
            <MenuItem key={value} value={value}>
              {t(label)}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          id="problemClassAction"
          size="small"
          select
          label={t("a11y.classAction")}
          value={draft.action}
          onChange={(event) =>
            setDraft({
              ...draft,
              action: event.target.value as Draft["action"],
            })
          }
        >
          <MenuItem value="report">{t("a11y.fileBugs")}</MenuItem>
          <MenuItem value="ignore">{t("common.ignore")}</MenuItem>
        </TextField>
        <Button
          variant="outlined"
          disabled={!hasCondition || draftErrors.some(Boolean)}
          onClick={addClass}
          sx={{ alignSelf: "start", mt: 0.25 }}
        >
          {t("a11y.addClass")}
        </Button>
      </Box>
    </Box>
  );
};
