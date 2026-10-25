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
  DEFAULT_DUPLICATE_MODES,
  DuplicateMode,
  ProblemClass,
  UiTreeSettings,
  parseUiTreeSettings,
} from "../../types/insights";

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

const modeLabel = (mode: DuplicateMode) =>
  MODES.find(([value]) => value === mode)?.[1] ?? mode;

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

const emptyClass = (): Omit<ProblemClass, "id"> => ({
  name: "",
  rules: [],
  match: "",
  mode: undefined,
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
  const [draft, setDraft] = React.useState(emptyClass);
  const draftError = patternError(draft.match);

  const save = (next: UiTreeSettings) =>
    setProjectEditState(projectDispatch, {
      ...project,
      uiTreeSettings: JSON.stringify(next),
    });

  const addClass = () => {
    const added: ProblemClass = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      name: draft.name.trim() || draft.match.trim(),
      match: draft.match.trim(),
      ...(draft.rules?.length ? { rules: draft.rules } : {}),
      ...(draft.mode ? { mode: draft.mode } : {}),
      action: draft.action ?? "report",
    };
    save({ ...settings, a11yClasses: [...classes, added] });
    setDraft(emptyClass());
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
        Matched against the element id (resource id or Compose test tag;
        Class:text for elements without one), first match wins. A glob with *
        and ?, or /regex/: a group in the regex becomes the component id, so{" "}
        <code>/^.*:id\/(tab)_\d+$/</code> makes tab_0…tab_3 one problem.
        “Ignore” lists the issues with the false positives and never files them.
      </Typography>
      {classes.map((item, index) => (
        <Box
          key={item.id}
          data-testid="a11yProblemClass"
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            flexWrap: "wrap",
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {item.name}
          </Typography>
          <code style={{ fontSize: 12.5 }}>{item.match}</code>
          <Typography variant="body2" color="textSecondary">
            {item.rules?.length ? item.rules.join(", ") : "every rule"} ·{" "}
            {item.action === "ignore"
              ? "ignored"
              : item.mode
                ? modeLabel(item.mode)
                : "rule's setting"}
          </Typography>
          <Box sx={{ ml: "auto", display: "flex" }}>
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
                  a11yClasses: classes.filter((other) => other.id !== item.id),
                })
              }
            >
              Remove
            </Button>
          </Box>
        </Box>
      ))}
      <Box
        sx={{
          display: "flex",
          gap: 1,
          flexWrap: "wrap",
          alignItems: "flex-start",
        }}
      >
        <TextField
          id="problemClassName"
          size="small"
          label="Name"
          value={draft.name}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          sx={{ width: 160 }}
        />
        <TextField
          id="problemClassMatch"
          size="small"
          label="Element id pattern"
          placeholder="*#PbButton or /^.*:id\/(tab)_\d+$/"
          value={draft.match}
          onChange={(event) =>
            setDraft({ ...draft, match: event.target.value })
          }
          error={!!draft.match && !!draftError}
          helperText={draft.match && draftError ? draftError : " "}
          sx={{ flex: "1 1 220px" }}
        />
        <TextField
          id="problemClassRules"
          size="small"
          select
          label="Rules"
          SelectProps={{
            multiple: true,
            renderValue: (value) =>
              (value as string[]).length ? (value as string[]).join(", ") : "",
          }}
          value={draft.rules ?? []}
          onChange={(event) =>
            setDraft({
              ...draft,
              rules: ([] as string[]).concat(
                event.target.value as string | string[],
              ) as A11yRule[],
            })
          }
          helperText="Empty for every rule"
          sx={{ width: 200 }}
        >
          {RULES.map(([rule, title]) => (
            <MenuItem key={rule} value={rule}>
              {title}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          id="problemClassMode"
          size="small"
          select
          label="Same problem when"
          value={draft.mode ?? ""}
          onChange={(event) =>
            setDraft({
              ...draft,
              mode: (event.target.value || undefined) as
                DuplicateMode | undefined,
            })
          }
          sx={{ width: 220 }}
        >
          <MenuItem value="">Rule&apos;s setting</MenuItem>
          {MODES.map(([value, label]) => (
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
          value={draft.action ?? "report"}
          onChange={(event) =>
            setDraft({
              ...draft,
              action: event.target.value as ProblemClass["action"],
            })
          }
          sx={{ width: 140 }}
        >
          <MenuItem value="report">File bugs</MenuItem>
          <MenuItem value="ignore">Ignore</MenuItem>
        </TextField>
        <Button
          variant="outlined"
          disabled={!!draftError}
          onClick={addClass}
          sx={{ mt: 0.25 }}
        >
          Add class
        </Button>
      </Box>
    </Box>
  );
};
