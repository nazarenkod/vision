import React from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  MenuItem,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { Delete } from "@mui/icons-material";
import { MessageKey, useT } from "../../i18n";
import { insightsService } from "../../services";
import {
  DeviceProfile,
  ElementRule,
  UiTreeSettings,
} from "../../types/insights";
import { deviceLabel } from "../../_helpers/device.helper";
import { tokens } from "../../theme";
import { SettingRow, SettingSection } from "./SettingRow";
import { NumberField } from "./NumberField";
import { ElementPicker } from "./ElementPicker";
import { UI_TREE_DEFAULTS } from "./defaults";
import { isSelector, selectorSeen } from "./patterns";
import { useFieldError, useProjectDraft } from "./useProjectDraft";
import { hasSuggestions, useVocabulary } from "./vocabulary";

type Toggle = keyof Pick<
  UiTreeSettings,
  | "excludeSystemBars"
  | "compensateMoves"
  | "detectSemanticChanges"
  | "detectLoading"
  | "detectScreenMismatch"
>;

const TOGGLES: Array<[Toggle, MessageKey, MessageKey]> = [
  ["excludeSystemBars", "mobile.systemBars", "mobile.systemBarsHelp"],
  ["compensateMoves", "mobile.moves", "mobile.movesHelp"],
  ["detectSemanticChanges", "mobile.hidden", "mobile.hiddenHelp"],
  ["detectLoading", "mobile.loading", "mobile.loadingHelp"],
  ["detectScreenMismatch", "mobile.wrongScreen", "mobile.wrongScreenHelp"],
];

const profileKey = (profile: DeviceProfile) =>
  JSON.stringify([
    profile.os,
    profile.device,
    profile.browser,
    profile.viewport,
  ]);

export const MobileTab: React.FunctionComponent = () => {
  const { t } = useT();
  const { settings, updateSettings } = useProjectDraft();
  const onOff = (value: boolean) => t(value ? "settings.on" : "settings.off");
  const moveError = useFieldError("maxMoveDp");

  return (
    <>
      <SettingSection
        title={t("mobile.comparison")}
        intro={t("mobile.comparisonIntro")}
      >
        {TOGGLES.map(([key, label, help]) => (
          <React.Fragment key={key}>
            <SettingRow
              label={t(label)}
              help={t(help)}
              defaultText={onOff(UI_TREE_DEFAULTS[key])}
              changed={!!settings[key] !== UI_TREE_DEFAULTS[key]}
              onReset={() => updateSettings({ [key]: UI_TREE_DEFAULTS[key] })}
              testId={`setting-${key}`}
            >
              <Switch
                name={key}
                inputProps={{ "aria-label": t(label) }}
                checked={!!settings[key]}
                onChange={(_, checked) => updateSettings({ [key]: checked })}
              />
            </SettingRow>
            {key === "compensateMoves" && settings.compensateMoves && (
              <SettingRow
                label={t("mobile.maxMove")}
                help={t("mobile.maxMoveHelp")}
                defaultText={t("mobile.anyDistance")}
                changed={settings.maxMoveDp !== null}
                onReset={() => updateSettings({ maxMoveDp: null })}
              >
                <NumberField
                  id="maxMoveDp"
                  allowEmpty
                  sx={{ width: 140 }}
                  placeholder={t("mobile.anyDistance")}
                  inputProps={{ "aria-label": t("mobile.maxMove") }}
                  value={settings.maxMoveDp}
                  error={!!moveError}
                  helperText={moveError}
                  onChange={(value) => updateSettings({ maxMoveDp: value })}
                />
              </SettingRow>
            )}
          </React.Fragment>
        ))}
      </SettingSection>
      <ReferenceDevice />
      <ElementRules />
    </>
  );
};

const ReferenceDevice = () => {
  const { t } = useT();
  const { project, settings, updateSettings } = useProjectDraft();
  const [devices, setDevices] = React.useState<
    Array<DeviceProfile & { checks: number }>
  >([]);

  React.useEffect(() => {
    if (!project.id) return;
    insightsService
      .getProjectDevices(project.id)
      .then(setDevices)
      .catch(() => setDevices([]));
  }, [project.id]);

  const reference = settings.referenceDevice ?? null;
  // the API lists devices with most checks first
  const options =
    reference && !devices.some((d) => profileKey(d) === profileKey(reference))
      ? [...devices, { ...reference, checks: 0 }]
      : devices;
  const recommended = devices[0] ? profileKey(devices[0]) : null;

  return (
    <SettingSection title={t("mobile.reference")}>
      <SettingRow
        label={t("mobile.referenceDevice")}
        help={t("mobile.referenceHelp")}
        defaultText={t("mobile.noReference")}
        changed={!!reference}
        onReset={() => updateSettings({ referenceDevice: null })}
        wide
      >
        <TextField
          id="referenceDevice"
          select
          size="small"
          fullWidth
          inputProps={{ "aria-label": t("mobile.referenceDevice") }}
          value={reference ? profileKey(reference) : ""}
          SelectProps={{ displayEmpty: true }}
          onChange={(event) => {
            const picked = options.find(
              (device) => profileKey(device) === event.target.value,
            );
            updateSettings({
              referenceDevice: picked
                ? {
                    os: picked.os,
                    device: picked.device,
                    browser: picked.browser,
                    viewport: picked.viewport,
                  }
                : null,
            });
          }}
        >
          <MenuItem value="">{t("mobile.noReference")}</MenuItem>
          {options.map((device) => (
            <MenuItem key={profileKey(device)} value={profileKey(device)}>
              <Box
                sx={{
                  display: "flex",
                  gap: 1,
                  alignItems: "center",
                  width: "100%",
                }}
              >
                <span>{deviceLabel(device)}</span>
                <Typography variant="caption" color="textSecondary">
                  {t("mobile.checks", { count: device.checks })}
                </Typography>
                {profileKey(device) === recommended && (
                  <Chip
                    size="small"
                    color="primary"
                    variant="outlined"
                    label={t("settings.recommended")}
                    sx={{ height: 20, fontSize: 11, ml: "auto" }}
                  />
                )}
              </Box>
            </MenuItem>
          ))}
        </TextField>
      </SettingRow>
    </SettingSection>
  );
};

const ElementRules = () => {
  const { t, formatNumber } = useT();
  const { settings, updateSettings } = useProjectDraft();
  const { vocabulary, loading } = useVocabulary();
  const [selector, setSelector] = React.useState("");
  const [action, setAction] = React.useState<ElementRule["action"]>("ignore");
  const [percent, setPercent] = React.useState<number | null>(5);
  // the picker keeps its text; a new key empties it after adding
  const [pickerKey, setPickerKey] = React.useState(0);
  const valid =
    isSelector(selector) &&
    (action === "ignore" ||
      (percent !== null && percent >= 0 && percent <= 100));

  const addRule = () => {
    const rule: ElementRule = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      selector: selector.trim(),
      action,
      ...(action === "tolerate" ? { maxDiffPercent: percent ?? 0 } : {}),
    };
    updateSettings({ elementRules: [...settings.elementRules, rule] });
    setSelector("");
    setPickerKey((key) => key + 1);
  };

  return (
    <SettingSection
      title={t("mobile.rules")}
      intro={t("mobile.rulesIntro")}
      testId="elementRules"
    >
      {!loading && !hasSuggestions(vocabulary) && (
        <Alert severity="info" sx={{ my: 1 }}>
          {t("settings.noSuggestions")}
        </Alert>
      )}
      {settings.elementRules.map((rule) => (
        <RuleRow
          key={rule.id}
          rule={rule}
          seen={
            !vocabulary || !hasSuggestions(vocabulary)
              ? true
              : selectorSeen(rule.selector, vocabulary)
          }
          label={
            rule.action === "ignore"
              ? t("mobile.ignored")
              : t("mobile.toleratedUpTo", {
                  percent: formatNumber(rule.maxDiffPercent ?? 0),
                })
          }
          onRemove={() =>
            updateSettings({
              elementRules: settings.elementRules.filter(
                (item) => item.id !== rule.id,
              ),
            })
          }
        />
      ))}
      {!settings.elementRules.length && (
        <Typography variant="body2" color="textSecondary" sx={{ py: 1 }}>
          {t("mobile.noRules")}
        </Typography>
      )}
      <Box
        sx={{
          display: "flex",
          gap: 1.5,
          alignItems: "flex-start",
          flexWrap: "wrap",
          pt: 2,
        }}
      >
        <ElementPicker
          key={pickerKey}
          id="ruleSelector"
          value={selector}
          onChange={setSelector}
        />
        <ToggleButtonGroup
          exclusive
          size="small"
          value={action}
          onChange={(_, next: ElementRule["action"] | null) =>
            next && setAction(next)
          }
          aria-label={t("mobile.ruleAction")}
          sx={{ height: 40 }}
        >
          <ToggleButton value="ignore">{t("mobile.ignore")}</ToggleButton>
          <ToggleButton value="tolerate">{t("mobile.tolerate")}</ToggleButton>
        </ToggleButtonGroup>
        {action === "tolerate" && (
          <NumberField
            id="rulePercent"
            label={t("mobile.percent")}
            sx={{ width: 110 }}
            value={percent}
            allowEmpty
            onChange={setPercent}
          />
        )}
        <Button
          variant="outlined"
          disabled={!valid}
          onClick={addRule}
          sx={{ height: 40 }}
        >
          {t("mobile.addRule")}
        </Button>
      </Box>
      <Typography
        variant="caption"
        color="textSecondary"
        component="div"
        sx={{ mt: 1 }}
      >
        {action === "ignore"
          ? t("mobile.ignoreHelp")
          : t("mobile.tolerateHelp")}
      </Typography>
    </SettingSection>
  );
};

const RuleRow: React.FunctionComponent<{
  rule: ElementRule;
  seen: boolean;
  label: string;
  onRemove: () => void;
}> = ({ rule, seen, label, onRemove }) => {
  const { t } = useT();
  const error = useFieldError(`rule-${rule.id}`);
  return (
    <Box
      id={`rule-${rule.id}`}
      tabIndex={-1}
      data-testid="elementRule"
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        py: 1,
        borderBottom: `1px solid ${tokens.border}`,
      }}
    >
      <Typography
        component="code"
        sx={{ fontFamily: tokens.mono, fontSize: 13 }}
      >
        {rule.selector}
      </Typography>
      <Typography variant="body2" color="textSecondary">
        {label}
      </Typography>
      {!seen && (
        <Chip
          size="small"
          color="warning"
          variant="outlined"
          label={t("mobile.notSeen")}
          sx={{ height: 20, fontSize: 11 }}
        />
      )}
      {error && (
        <Typography variant="caption" color="error">
          {error}
        </Typography>
      )}
      <IconButton
        size="small"
        sx={{ ml: "auto" }}
        aria-label={t("mobile.removeRule", { selector: rule.selector })}
        onClick={onRemove}
      >
        <Delete fontSize="small" />
      </IconButton>
    </Box>
  );
};
