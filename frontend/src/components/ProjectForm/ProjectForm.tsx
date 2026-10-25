import {
  Box,
  Button,
  Divider,
  TextField,
  Typography,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  SelectChangeEvent,
} from "@mui/material";
import React from "react";
import { TextValidator } from "react-material-ui-form-validator";
import {
  useProjectState,
  useProjectDispatch,
  setProjectEditState,
} from "../../contexts";
import { ImageComparison } from "../../types/imageComparison";
import { Tooltip } from "../Tooltip";
import { LooksSameConfigForm } from "./LooksSameConfigForm";
import { OdiffConfigForm } from "./OdiffConfigForm";
import { PixelmatchConfigForm } from "./PixelmatchConfigForm";
import { VlmConfigForm } from "./VlmConfigForm";
import { getDefaultConfig } from "./utils";
import {
  DeviceProfile,
  ElementRule,
  UiTreeSettings,
  parseUiTreeSettings,
} from "../../types/insights";
import { insightsService } from "../../services";
import { A11yProblemSettings } from "./A11yProblemSettings";

const profileLabel = (profile: DeviceProfile) =>
  [profile.device, profile.os, profile.browser, profile.viewport]
    .filter(Boolean)
    .join(" · ") || "No device";
const profileKey = (profile: DeviceProfile) =>
  JSON.stringify([
    profile.os,
    profile.device,
    profile.browser,
    profile.viewport,
  ]);

export const ProjectForm: React.FunctionComponent = () => {
  const { projectEditState: project } = useProjectState();
  const projectDispatch = useProjectDispatch();

  const config = React.useMemo(() => {
    switch (project.imageComparison) {
      case ImageComparison.pixelmatch:
        return <PixelmatchConfigForm />;

      case ImageComparison.lookSame:
        return <LooksSameConfigForm />;

      case ImageComparison.odiff:
        return <OdiffConfigForm />;

      case ImageComparison.vlm:
        return <VlmConfigForm />;

      default:
        return null;
    }
  }, [project.imageComparison]);

  return (
    <React.Fragment>
      <TextValidator
        name="projectName"
        validators={["minStringLength:2"]}
        errorMessages={["Enter at least two characters."]}
        margin="dense"
        id="name"
        label="Project name"
        type="text"
        fullWidth
        required
        value={project.name}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
          setProjectEditState(projectDispatch, {
            ...project,
            name: event.target.value,
          });
        }}
      />
      <TextValidator
        name="mainBranchName"
        validators={["minStringLength:2"]}
        errorMessages={["Enter at least two characters."]}
        margin="dense"
        id="branchName"
        label="Main branch"
        type="text"
        fullWidth
        required
        value={project.mainBranchName}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
          setProjectEditState(projectDispatch, {
            ...project,
            mainBranchName: event.target.value,
          })
        }
      />
      <TextValidator
        name="buildCount"
        validators={["minNumber:1"]}
        errorMessages={["Enter greater than 1"]}
        InputProps={{
          inputProps: {
            min: 1,
            step: 1,
          },
        }}
        margin="dense"
        id="buildCount"
        label="Number of builds to keep"
        type="number"
        fullWidth
        required
        value={project.maxBuildAllowed}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
          const { value } = event.target;

          setProjectEditState(projectDispatch, {
            ...project,
            maxBuildAllowed: parseInt(value),
          });
        }}
      />
      <TextValidator
        name="maxBranchLifetime"
        validators={["minNumber:1"]}
        errorMessages={["Enter greater than 1"]}
        InputProps={{
          inputProps: {
            min: 1,
            step: 1,
          },
        }}
        margin="dense"
        id="maxBranchLifetime"
        label="Max branch lifetime (days)"
        type="number"
        fullWidth
        required
        value={project.maxBranchLifetime}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
          const { value } = event.target;

          setProjectEditState(projectDispatch, {
            ...project,
            maxBranchLifetime: parseInt(value),
          });
        }}
      />
      <FormControlLabel
        label="Auto approve feature"
        control={
          <Switch
            checked={project.autoApproveFeature}
            onChange={(event, checked) =>
              setProjectEditState(projectDispatch, {
                ...project,
                autoApproveFeature: checked,
              })
            }
            color="primary"
            name="autoApproveFeature"
          />
        }
      />
      <Tooltip title="Review and bulk approve or reject a screen's variations (e.g. all locales) in one dialog. Only variations with the same change are pre-selected; different ones are left for manual review.">
        <FormControlLabel
          label="Bulk approve/reject variations"
          control={
            <Switch
              checked={project.bulkApproveVariations}
              onChange={(event, checked) =>
                setProjectEditState(projectDispatch, {
                  ...project,
                  bulkApproveVariations: checked,
                })
              }
              color="primary"
              name="bulkApproveVariations"
            />
          }
        />
      </Tooltip>
      {/* not tied to the switch above: the axis also decides what the test run
          list groups into one card, which it does whether or not variations can
          be bulk approved */}
      <Tooltip title="Which test-variation axis differs within a group. Screens that match on everything except this axis are grouped in the test run list and reviewed together — e.g. customTags for per-locale screenshots.">
        <FormControl variant="standard" fullWidth>
          <InputLabel id="bulkApproveGroupBySelect">
            Group variations by
          </InputLabel>
          <Select
            variant="standard"
            id="bulkApproveGroupBySelect"
            labelId="bulkApproveGroupBySelect"
            value={project.bulkApproveGroupBy}
            onChange={(event: SelectChangeEvent<HTMLInputElement>) =>
              setProjectEditState(projectDispatch, {
                ...project,
                bulkApproveGroupBy: event.target.value as string,
              })
            }
          >
            <MenuItem value="customTags">customTags</MenuItem>
            <MenuItem value="os">os</MenuItem>
            <MenuItem value="device">device</MenuItem>
            <MenuItem value="viewport">viewport</MenuItem>
            <MenuItem value="browser">browser</MenuItem>
          </Select>
        </FormControl>
      </Tooltip>
      <FormControl variant="standard" fullWidth>
        <InputLabel id="imageComparisonSelect">
          Image comparison library
        </InputLabel>
        <Select
          variant="standard"
          id="imageComparisonSelect"
          labelId="imageComparisonSelect"
          value={project.imageComparison}
          onChange={(event: SelectChangeEvent<HTMLInputElement>) => {
            const imageComparison = event.target.value as ImageComparison;

            setProjectEditState(projectDispatch, {
              ...project,
              imageComparison,
              imageComparisonConfig:
                project.imageComparison !== imageComparison
                  ? getDefaultConfig(imageComparison)
                  : project.imageComparisonConfig,
            });
          }}
        >
          <MenuItem value={ImageComparison.pixelmatch}>
            {ImageComparison.pixelmatch}
          </MenuItem>
          <MenuItem value={ImageComparison.lookSame}>
            {ImageComparison.lookSame}
          </MenuItem>
          <MenuItem value={ImageComparison.odiff}>
            {ImageComparison.odiff}
          </MenuItem>
          <MenuItem value={ImageComparison.vlm}>{ImageComparison.vlm}</MenuItem>
        </Select>
      </FormControl>
      {config}
      <MobileSettings />
      <A11yProblemSettings />
      <JiraSettings />
    </React.Fragment>
  );
};

/** Jira connection used to file accessibility bugs from the review screen. */
const JiraSettings: React.FunctionComponent = () => {
  const { projectEditState: project } = useProjectState();
  const projectDispatch = useProjectDispatch();
  // the API never returns the token, only whether one is saved
  const tokenSaved = !!(project as { jiraTokenSet?: boolean }).jiraTokenSet;
  const update = (patch: Partial<typeof project>) =>
    setProjectEditState(projectDispatch, { ...project, ...patch });

  return (
    <Box sx={{ mt: 3, display: "flex", flexDirection: "column", gap: 1.5 }}>
      <Divider />
      <Typography variant="subtitle1">Jira</Typography>
      <Typography variant="body2" color="textSecondary">
        Lets reviewers file accessibility bugs from the review screen. Each
        person adds their own Jira token in their profile, so bugs are filed as
        them. A shared token here is optional: it is used for people who have
        not added one.
      </Typography>
      <TextField
        id="jiraUrl"
        label="Jira URL"
        placeholder="https://jira.example.com"
        size="small"
        value={project.jiraUrl ?? ""}
        onChange={(event) => update({ jiraUrl: event.target.value })}
      />
      <TextField
        id="jiraToken"
        label="Shared token (optional)"
        type="password"
        size="small"
        autoComplete="new-password"
        placeholder={tokenSaved ? "Saved. Leave empty to keep it" : ""}
        value={project.jiraToken ?? ""}
        onChange={(event) =>
          update({ jiraToken: event.target.value || undefined })
        }
        helperText={
          tokenSaved && project.jiraToken === ""
            ? "The saved token will be removed"
            : " "
        }
      />
      {tokenSaved && project.jiraToken === undefined && (
        <Button
          size="small"
          sx={{ alignSelf: "flex-start" }}
          onClick={() => update({ jiraToken: "" })}
        >
          Remove saved token
        </Button>
      )}
      <TextField
        id="jiraEmail"
        label="Shared token's account email (Jira Cloud only)"
        size="small"
        value={project.jiraEmail ?? ""}
        onChange={(event) => update({ jiraEmail: event.target.value })}
      />
      <Box sx={{ display: "flex", gap: 1.5 }}>
        <TextField
          id="jiraIssueType"
          label="Issue type"
          placeholder="Bug"
          size="small"
          fullWidth
          value={project.jiraIssueType ?? ""}
          onChange={(event) => update({ jiraIssueType: event.target.value })}
        />
        <TextField
          id="jiraLinkType"
          label="Link type"
          placeholder="Relates"
          size="small"
          fullWidth
          value={project.jiraLinkType ?? ""}
          onChange={(event) => update({ jiraLinkType: event.target.value })}
        />
      </Box>
    </Box>
  );
};

const TOGGLES: Array<[keyof UiTreeSettings, string, string]> = [
  [
    "excludeSystemBars",
    "Leave out status and navigation bars",
    "Clock, battery and signal change on every run.",
  ],
  [
    "compensateMoves",
    "Compare moved elements at their new place",
    "An element that only moved (a banner pushed the list down) is not a difference; a change inside it still is.",
  ],
  [
    "detectSemanticChanges",
    "Send hidden changes to review",
    "A new label, a disabled or unclickable control, an invisible button: changes the pixels do not show.",
  ],
  [
    "detectLoading",
    "Warn about loading states",
    "Spinners, skeletons and toasts mean the screenshot was taken too early.",
  ],
  [
    "detectScreenMismatch",
    "Warn about wrong screens",
    "The UI tree looks like another screen than the baseline.",
  ],
];

/** UI tree comparison settings and rules for every screen of the project. */
const MobileSettings: React.FunctionComponent = () => {
  const { projectEditState: project } = useProjectState();
  const projectDispatch = useProjectDispatch();
  const settings = parseUiTreeSettings(project.uiTreeSettings);
  const [selector, setSelector] = React.useState("");
  const [action, setAction] = React.useState<ElementRule["action"]>("ignore");
  const [percent, setPercent] = React.useState(5);
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
  const deviceOptions =
    reference && !devices.some((d) => profileKey(d) === profileKey(reference))
      ? [...devices, { ...reference, checks: 0 }]
      : devices;

  const save = (next: UiTreeSettings) =>
    setProjectEditState(projectDispatch, {
      ...project,
      uiTreeSettings: JSON.stringify(next),
    });

  const addRule = () => {
    const rule: ElementRule = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      selector: selector.trim(),
      action,
      ...(action === "tolerate" ? { maxDiffPercent: percent } : {}),
    };
    save({ ...settings, elementRules: [...settings.elementRules, rule] });
    setSelector("");
  };

  return (
    <Box sx={{ mt: 3, display: "flex", flexDirection: "column", gap: 1 }}>
      <Divider />
      <Typography variant="subtitle1">Mobile screenshots (UI tree)</Typography>
      <Typography variant="body2" color="textSecondary">
        Applies to screenshots sent with an Appium page source.
      </Typography>
      {TOGGLES.map(([key, label, help]) => (
        <FormControlLabel
          key={key}
          control={
            <Switch
              checked={!!settings[key]}
              onChange={(_, checked) => save({ ...settings, [key]: checked })}
              name={key}
            />
          }
          label={
            <Box>
              <Typography variant="body2">{label}</Typography>
              <Typography variant="caption" color="textSecondary">
                {help}
              </Typography>
            </Box>
          }
          sx={{ alignItems: "flex-start", "& .MuiSwitch-root": { mt: -0.5 } }}
        />
      ))}
      <TextField
        id="referenceDevice"
        select
        size="small"
        label="Reference device"
        value={reference ? profileKey(reference) : ""}
        onChange={(event) => {
          const picked = deviceOptions.find(
            (d) => profileKey(d) === event.target.value,
          );
          save({
            ...settings,
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
        helperText="Other devices of a check are compared with it element by element, for information; it never changes a status."
        sx={{ maxWidth: 520, mt: 1 }}
      >
        <MenuItem value="">None</MenuItem>
        {deviceOptions.map((device) => (
          <MenuItem key={profileKey(device)} value={profileKey(device)}>
            {profileLabel(device)}
            {device.checks ? ` (${device.checks} checks)` : ""}
          </MenuItem>
        ))}
      </TextField>
      {settings.compensateMoves && (
        <TextField
          id="maxMoveDp"
          size="small"
          type="number"
          label="Only moves up to, dp (empty for any)"
          value={settings.maxMoveDp ?? ""}
          onChange={(event) =>
            save({
              ...settings,
              maxMoveDp:
                event.target.value === "" ? null : Number(event.target.value),
            })
          }
          sx={{ maxWidth: 280 }}
        />
      )}
      <Typography variant="body2" sx={{ fontWeight: 600, mt: 1 }}>
        Element rules for every screen
      </Typography>
      {settings.elementRules.map((rule) => (
        <Box
          key={rule.id}
          sx={{ display: "flex", alignItems: "center", gap: 1 }}
        >
          <code style={{ fontSize: 12.5 }}>{rule.selector}</code>
          <Typography variant="body2" color="textSecondary">
            {rule.action === "ignore" ? "ignored" : `±${rule.maxDiffPercent}%`}
          </Typography>
          <Button
            size="small"
            sx={{ ml: "auto" }}
            onClick={() =>
              save({
                ...settings,
                elementRules: settings.elementRules.filter(
                  (item) => item.id !== rule.id,
                ),
              })
            }
          >
            Remove
          </Button>
        </Box>
      ))}
      <Box
        sx={{
          display: "flex",
          gap: 1,
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        <TextField
          id="ruleSelector"
          size="small"
          label="Element"
          placeholder="id:clock or class:MapView"
          value={selector}
          onChange={(event) => setSelector(event.target.value)}
          sx={{ flex: "1 1 200px" }}
        />
        <TextField
          id="ruleAction"
          size="small"
          select
          value={action}
          onChange={(event) =>
            setAction(event.target.value as ElementRule["action"])
          }
          sx={{ width: 130 }}
        >
          <MenuItem value="ignore">Ignore</MenuItem>
          <MenuItem value="tolerate">Tolerate</MenuItem>
        </TextField>
        {action === "tolerate" && (
          <TextField
            id="rulePercent"
            size="small"
            type="number"
            label="%"
            value={percent}
            onChange={(event) => setPercent(Number(event.target.value))}
            sx={{ width: 80 }}
          />
        )}
        <Button
          variant="outlined"
          disabled={!/^(id|class|text):.+/.test(selector.trim())}
          onClick={addRule}
        >
          Add
        </Button>
      </Box>
    </Box>
  );
};
