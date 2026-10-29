import React from "react";
import {
  Box,
  Divider,
  FormControlLabel,
  InputAdornment,
  Link,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import {
  setProjectEditState,
  useProjectDispatch,
  useProjectState,
} from "../../contexts";
import {
  A11Y_NORM_LIMITS,
  A11Y_RULES,
  A11yNormField,
  A11yNorms,
  A11yRule,
  a11yNormsOf,
  DEFAULT_A11Y_NORMS,
  parseNorm,
  parseUiTreeSettings,
} from "../../types/insights";
import { MessageKey, useT } from "../../i18n";

const RULE_LABEL: Record<A11yRule, MessageKey> = {
  "touch-target": "a11y.rule.touchTarget",
  "low-contrast": "a11y.rule.lowContrast",
  "missing-label": "a11y.rule.missingLabel",
  "input-without-label": "a11y.rule.inputWithoutLabel",
  "duplicate-label": "a11y.rule.duplicateLabel",
  "not-accessible": "a11y.rule.notAccessible",
  "redundant-role": "a11y.rule.redundantRole",
};

const RULE_NOTE: Partial<Record<A11yRule, MessageKey>> = {
  "not-accessible": "a11y.norm.iosOnly",
  "redundant-role": "a11y.norm.advice",
};

// the norms a rule is checked by, with the caption above them
const RULE_NORMS: Partial<
  Record<
    A11yRule,
    {
      caption: MessageKey;
      fields: Array<[A11yNormField, MessageKey, string]>;
    }
  >
> = {
  "touch-target": {
    caption: "a11y.norm.touchTarget",
    fields: [
      ["touchTargetAndroid", "a11y.norm.android", "dp"],
      ["touchTargetIos", "a11y.norm.ios", "pt"],
    ],
  },
  "low-contrast": {
    caption: "a11y.norm.contrast",
    fields: [
      ["contrast", "a11y.norm.text", ": 1"],
      ["contrastLarge", "a11y.norm.large", ": 1"],
    ],
  },
};

/** One norm: saved as soon as it is a number within limits, else says why not. */
const NormField: React.FunctionComponent<{
  field: A11yNormField;
  label: MessageKey;
  unit: string;
  value: number;
  onChange: (value: number) => void;
}> = ({ field, label, unit, value, onChange }) => {
  const { t } = useT();
  const [text, setText] = React.useState(String(value));
  // a reset or another tab's save changes the value under the field
  React.useEffect(() => {
    setText((current) =>
      parseNorm(field, current) === value ? current : String(value),
    );
  }, [field, value]);
  const parsed = parseNorm(field, text);
  const limits = A11Y_NORM_LIMITS[field];
  const fallback = DEFAULT_A11Y_NORMS[field];

  return (
    <TextField
      id={`norm-${field}`}
      size="small"
      label={t(label)}
      value={text}
      inputProps={{ inputMode: "decimal" }}
      InputProps={{
        endAdornment: <InputAdornment position="end">{unit}</InputAdornment>,
      }}
      onChange={(event) => {
        setText(event.target.value);
        const next = parseNorm(field, event.target.value);
        if (next !== null) onChange(next);
      }}
      error={parsed === null}
      helperText={
        parsed === null ? (
          t(limits.integer ? "a11y.norm.whole" : "a11y.norm.range", {
            min: limits.min,
            max: limits.max,
          })
        ) : (
          <>
            {t("a11y.norm.default", { value: fallback })}
            {value !== fallback && (
              <>
                {" · "}
                <Link
                  component="button"
                  type="button"
                  variant="caption"
                  data-testid={`reset-${field}`}
                  onClick={() => {
                    setText(String(fallback));
                    onChange(fallback);
                  }}
                >
                  {t("a11y.norm.reset")}
                </Link>
              </>
            )}
          </>
        )
      }
      sx={{ width: 170 }}
    />
  );
};

/**
 * The project's accessibility norms (026): each rule on or off, and the tap
 * area and contrast the team agreed on. How problems are told apart is fixed
 * (021) and the screen title is not set here, so neither is shown.
 */
export const A11yRulesSettings: React.FunctionComponent<{
  // on the settings page the section card carries the heading
  bare?: boolean;
}> = ({ bare = false }) => {
  const { projectEditState: project } = useProjectState();
  const projectDispatch = useProjectDispatch();
  const { t } = useT();
  const settings = parseUiTreeSettings(project.uiTreeSettings);
  const norms = a11yNormsOf(settings);

  const save = (next: A11yNorms) =>
    setProjectEditState(projectDispatch, {
      ...project,
      uiTreeSettings: JSON.stringify({ ...settings, a11yNorms: next }),
    });

  return (
    <Box
      sx={{ mt: bare ? 0 : 3, display: "flex", flexDirection: "column" }}
      data-testid="a11yRules"
    >
      {!bare && <Divider />}
      {!bare && (
        <Typography variant="subtitle1" sx={{ mt: 1 }}>
          {t("section.a11y")}
        </Typography>
      )}
      {!bare && (
        <Typography variant="body2" color="textSecondary">
          {t("section.a11yIntro")}
        </Typography>
      )}
      {A11Y_RULES.map((rule, index) => {
        const on = !norms.disabledRules.includes(rule);
        const note = RULE_NOTE[rule];
        const ruleNorms = RULE_NORMS[rule];
        return (
          <Box
            key={rule}
            data-testid={`a11yRule-${rule}`}
            sx={{
              py: 1,
              borderTop: index ? 1 : 0,
              borderColor: "divider",
            }}
          >
            <FormControlLabel
              control={
                <Switch
                  checked={on}
                  name={rule}
                  onChange={(_, checked) =>
                    save({
                      ...norms,
                      disabledRules: checked
                        ? norms.disabledRules.filter((item) => item !== rule)
                        : [...norms.disabledRules, rule],
                    })
                  }
                />
              }
              label={
                <Typography
                  variant="body2"
                  color={on ? "textPrimary" : "textSecondary"}
                >
                  {t(RULE_LABEL[rule])}
                  {note && (
                    <Typography
                      component="span"
                      variant="caption"
                      color="textSecondary"
                    >
                      {` · ${t(note)}`}
                    </Typography>
                  )}
                </Typography>
              }
            />
            {ruleNorms && on && (
              <Box sx={{ pl: 6.5, pt: 0.5 }}>
                <Typography
                  variant="caption"
                  color="textSecondary"
                  component="div"
                  sx={{ mb: 1 }}
                >
                  {t(ruleNorms.caption)}
                </Typography>
                <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                  {ruleNorms.fields.map(([field, label, unit]) => (
                    <NormField
                      key={field}
                      field={field}
                      label={label}
                      unit={unit}
                      value={norms[field]}
                      onChange={(value) => save({ ...norms, [field]: value })}
                    />
                  ))}
                </Box>
              </Box>
            )}
          </Box>
        );
      })}
      <Typography
        variant="caption"
        color="textSecondary"
        sx={{ mt: 1, maxWidth: 640 }}
        data-testid="a11yNormsApply"
      >
        {t("a11y.norm.applies")}
      </Typography>
    </Box>
  );
};
