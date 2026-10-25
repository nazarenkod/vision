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

const RULES: Array<[A11yRule, string]> = [
  ["touch-target", "Touch target too small"],
  ["low-contrast", "Low text contrast"],
  ["missing-label", "Control has no label"],
  ["input-without-label", "Input has no label or hint"],
  ["duplicate-label", "Same label on several controls"],
  ["redundant-role", "Label repeats the role"],
  ["not-accessible", "Control hidden from VoiceOver"],
];

const MODES: Array<[DuplicateMode, string]> = [
  ["component-value", "Same component and values"],
  ["component", "Same component, any values"],
  ["screen", "Each screen on its own"],
];

/** The same check as the server's: a /regex/ must compile; a glob always does. */
const patternError = (pattern: string): string | null => {
  const regex = /^\/(.+)\/([a-z]*)$/s.exec(pattern.trim());
  if (!pattern.trim()) return "Required";
  if (!regex) return null;
  try {
    new RegExp(regex[1], regex[2].replace(/[^imsu]/g, ""));
    return null;
  } catch (error) {
    return `${error}`;
  }
};

type Field = keyof ClassConditions;

const FIELDS: Array<[Field, string, string]> = [
  ["element", "Element id", "*#PbButton or /^.*:id\\/(tab)_\\d+$/"],
  ["screen", "Screen", "Онбординг*"],
  ["className", "Element class", "*ImageButton"],
  ["label", "Element label", "/^Закрити$/"],
];

const GROUPINGS: Array<[GroupBy, string]> = [
  ...MODES,
  ["class", "Everything this class takes"],
];

const groupingLabel = (groupBy: GroupBy) =>
  GROUPINGS.find(([value]) => value === groupBy)?.[1] ?? groupBy;

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
export const A11yProblemSettings: React.FunctionComponent = () => {
  const { projectEditState: project } = useProjectState();
  const projectDispatch = useProjectDispatch();
  const settings = parseUiTreeSettings(project.uiTreeSettings);
  const classes = settings.a11yClasses ?? [];
  const [titleText, setTitleText] = React.useState(
    (settings.screenTitle ?? ["id:Appbar#Title"]).join("\n"),
  );
  const [draft, setDraft] = React.useState(emptyDraft);
  const draftErrors = FIELDS.map(([field]) =>
    lines(draft.conditions[field])
      .map(patternError)
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
      sx={{ mt: 3, display: "flex", flexDirection: "column", gap: 1 }}
      data-testid="a11yProblemSettings"
    >
      <Divider />
      <Typography variant="subtitle1">Accessibility problems</Typography>
      <Typography variant="body2" color="textSecondary">
        One bug per problem. A problem has an id (a11y-…) that goes into the
        Jira bug&apos;s summary and labels; Vision checks its own records and
        Jira for it before filing, and marks problems found in Jira as filed.
      </Typography>

      <TextField
        id="screenTitleSelectors"
        size="small"
        multiline
        minRows={2}
        label="Screen title in the UI tree"
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
        helperText="One selector per line, first match wins: id:Appbar#Title, id:toolbar_title, class:…, text:/regex/. Without a match, the check's name is the screen."
        sx={{ maxWidth: 520 }}
      />

      <Typography variant="body2" sx={{ fontWeight: 600, mt: 1 }}>
        Same problem when
      </Typography>
      <Typography variant="caption" color="textSecondary">
        Per rule, for elements with an id. A component&apos;s problem holds on
        every screen with it: filed once, covered everywhere. Elements without
        an id are always a problem of their own screen.
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
            <Typography variant="body2">{title}</Typography>
            <TextField
              select
              size="small"
              inputProps={{ "aria-label": `Same problem when: ${title}` }}
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
                  {label}
                </MenuItem>
              ))}
            </TextField>
          </React.Fragment>
        ))}
      </Box>

      <Typography variant="body2" sx={{ fontWeight: 600, mt: 1 }}>
        Problem classes
      </Typography>
      <Typography variant="caption" color="textSecondary">
        First match wins. A class takes an issue when every field filled in
        matches; within a field, one pattern per line, any may match. Patterns
        are globs with * and ?, or /regex/; a group in an element id regex
        becomes the component, so <code>/^.*:id\/(tab)_\d+$/</code> makes
        tab_0…tab_3 one problem. “Everything this class takes” makes all of it
        one problem; “Ignore” lists it with the false positives and never files
        it. Problem ids never change with these settings: what is one problem is
        worked out again from what each problem was filed for.
      </Typography>
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
                    {label}:{" "}
                    <code style={{ fontSize: 12 }}>
                      {when[field]?.join("  |  ")}
                    </code>
                  </Typography>
                ),
              )}
              <Typography variant="caption" color="textSecondary">
                {item.rules?.length ? item.rules.join(", ") : "every rule"} ·{" "}
                {item.action === "ignore"
                  ? "ignored"
                  : groupBy
                    ? groupingLabel(groupBy)
                    : "rule's setting"}
              </Typography>
            </Box>
            <Box sx={{ display: "flex" }}>
              <Button
                size="small"
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                Up
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
                Remove
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
          label="Name"
          value={draft.name}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
        />
        {FIELDS.map(([field, label, placeholder], index) => (
          <TextField
            key={field}
            id={`problemClass-${field}`}
            size="small"
            multiline
            label={label}
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
            helperText={draftErrors[index] ?? "One pattern per line"}
          />
        ))}
        <TextField
          id="problemClassRules"
          size="small"
          select
          label="Rules"
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
          helperText="Empty for every rule"
        >
          {RULES.map(([rule, title]) => (
            <MenuItem key={rule} value={rule}>
              {title}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          id="problemClassGroupBy"
          size="small"
          select
          label="Same problem when"
          value={draft.groupBy}
          onChange={(event) =>
            setDraft({ ...draft, groupBy: event.target.value as GroupBy | "" })
          }
        >
          <MenuItem value="">Rule&apos;s setting</MenuItem>
          {GROUPINGS.map(([value, label]) => (
            <MenuItem key={value} value={value}>
              {label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          id="problemClassAction"
          size="small"
          select
          label="Then"
          value={draft.action}
          onChange={(event) =>
            setDraft({
              ...draft,
              action: event.target.value as Draft["action"],
            })
          }
        >
          <MenuItem value="report">File bugs</MenuItem>
          <MenuItem value="ignore">Ignore</MenuItem>
        </TextField>
        <Button
          variant="outlined"
          disabled={!hasCondition || draftErrors.some(Boolean)}
          onClick={addClass}
          sx={{ alignSelf: "start", mt: 0.25 }}
        >
          Add class
        </Button>
      </Box>
    </Box>
  );
};
