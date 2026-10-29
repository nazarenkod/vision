import {
  Box,
  ButtonBase,
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
import { motion, tokens } from "../../theme";
import { LooksSameConfigForm } from "./LooksSameConfigForm";
import { OdiffConfigForm } from "./OdiffConfigForm";
import { PixelmatchConfigForm } from "./PixelmatchConfigForm";
import { VlmConfigForm } from "./VlmConfigForm";
import { getDefaultConfig } from "./utils";
import {
  DeviceProfile,
  UiTreeSettings,
  parseUiTreeSettings,
} from "../../types/insights";
import { insightsService } from "../../services";
import { A11yProblemSettings } from "./A11yProblemSettings";
import { deviceLabel } from "../../_helpers/device.helper";
import { SecretField } from "./SecretField";

const profileLabel = (profile: DeviceProfile) => deviceLabel(profile);
const profileKey = (profile: DeviceProfile) =>
  JSON.stringify([
    profile.os,
    profile.device,
    profile.browser,
    profile.viewport,
  ]);

// what each engine is for, in one sentence (REQ-018-44)
const ENGINES: Array<[ImageComparison, string]> = [
  [
    ImageComparison.pixelmatch,
    "Pixel by pixel. Fast and predictable; the default.",
  ],
  [
    ImageComparison.lookSame,
    "Forgives anti-aliasing and the text caret. Good for text-heavy screens.",
  ],
  [
    ImageComparison.odiff,
    "The fastest on big screenshots. Can fail on any layout change.",
  ],
  [
    ImageComparison.vlm,
    "Asks a vision model whether a change matters. Slower; needs a provider.",
  ],
];

const useEditedProject = () => {
  const { projectEditState: project } = useProjectState();
  const projectDispatch = useProjectDispatch();
  return { project, projectDispatch };
};

/** Name, main branch and how long builds are kept. */
export const GeneralFields: React.FunctionComponent = () => {
  const { project, projectDispatch } = useEditedProject();
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
    </React.Fragment>
  );
};

/** Auto approve and reviewing a screen's variations together. */
export const ReviewFields: React.FunctionComponent = () => {
  const { project, projectDispatch } = useEditedProject();
  return (
    <React.Fragment>
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
    </React.Fragment>
  );
};

/** The engine as cards, and below them only the chosen engine's settings. */
export const ComparisonFields: React.FunctionComponent<{
  as?: "cards" | "select";
  // creating a project picks the engine only; its settings come later
  withConfig?: boolean;
}> = ({ as = "cards", withConfig = true }) => {
  const { project, projectDispatch } = useEditedProject();
  const pick = (imageComparison: ImageComparison) =>
    setProjectEditState(projectDispatch, {
      ...project,
      imageComparison,
      imageComparisonConfig:
        project.imageComparison !== imageComparison
          ? getDefaultConfig(imageComparison)
          : project.imageComparisonConfig,
    });

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

  if (as === "select") {
    return (
      <React.Fragment>
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
            <MenuItem value={ImageComparison.vlm}>
              {ImageComparison.vlm}
            </MenuItem>
          </Select>
        </FormControl>
        {withConfig && config}
      </React.Fragment>
    );
  }

  return (
    <React.Fragment>
      <Box
        role="radiogroup"
        aria-label="Image comparison"
        data-testid="engineCards"
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
          gap: 1.25,
        }}
      >
        {ENGINES.map(([engine, description]) => {
          const on = project.imageComparison === engine;
          return (
            <ButtonBase
              key={engine}
              role="radio"
              aria-checked={on}
              data-testid={`engine-${engine}`}
              onClick={() => pick(engine)}
              sx={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                textAlign: "left",
                gap: 0.5,
                p: 1.5,
                pr: 4,
                borderRadius: 3,
                border: `1px solid ${on ? tokens.brand : tokens.borderStrong}`,
                boxShadow: on ? `0 0 0 1px ${tokens.brand}` : "none",
                bgcolor: on ? tokens.brandSoft : tokens.surface,
                transition: `border-color ${motion.base}ms, background-color ${motion.base}ms, box-shadow ${motion.base}ms`,
                "&:hover": { borderColor: tokens.brand },
              }}
            >
              <Box
                aria-hidden="true"
                sx={{
                  position: "absolute",
                  top: 12,
                  right: 12,
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  border: `${on ? 5 : 1.5}px solid ${on ? tokens.brand : tokens.borderStrong}`,
                  transition: `border ${motion.base}ms ${motion.easing}`,
                }}
              />
              <Typography
                sx={{ fontFamily: tokens.mono, fontWeight: 600, fontSize: 13 }}
              >
                {engine}
              </Typography>
              <Typography
                variant="caption"
                color="textSecondary"
                sx={{ lineHeight: 1.4 }}
              >
                {description}
              </Typography>
            </ButtonBase>
          );
        })}
      </Box>
      <Box key={project.imageComparison} className="v-enter" sx={{ mt: 1 }}>
        {config}
      </Box>
    </React.Fragment>
  );
};

/** Creating a project: three fields; the rest is set on its settings page. */
export const NewProjectFields: React.FunctionComponent = () => {
  const { project, projectDispatch } = useEditedProject();
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
        onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
          setProjectEditState(projectDispatch, {
            ...project,
            name: event.target.value,
          })
        }
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
      <ComparisonFields as="select" withConfig={false} />
      <Typography variant="body2" color="textSecondary" sx={{ mt: 1.5 }}>
        Mobile screenshots, accessibility and Jira are set up in the
        project&apos;s settings, which open right after it is created.
      </Typography>
    </React.Fragment>
  );
};

/** Everything in one column: what the old dialog showed. */
export const ProjectForm: React.FunctionComponent = () => (
  <React.Fragment>
    <GeneralFields />
    <ReviewFields />
    <ComparisonFields as="select" />
    <MobileSettings />
    <A11yProblemSettings />
    <JiraSettings />
  </React.Fragment>
);

/** Jira connection used to file accessibility bugs from the review screen. */
export const JiraSettings: React.FunctionComponent<{ bare?: boolean }> = ({
  bare = false,
}) => {
  const { projectEditState: project } = useProjectState();
  const projectDispatch = useProjectDispatch();
  // the API never returns the token, only whether one is saved
  const tokenSaved = !!(project as { jiraTokenSet?: boolean }).jiraTokenSet;
  const update = (patch: Partial<typeof project>) =>
    setProjectEditState(projectDispatch, { ...project, ...patch });

  return (
    <Box
      sx={{
        mt: bare ? 0 : 3,
        display: "flex",
        flexDirection: "column",
        gap: 1.5,
      }}
    >
      {!bare && <Divider />}
      {!bare && <Typography variant="subtitle1">Jira</Typography>}
      {!bare && (
        <Typography variant="body2" color="textSecondary">
          Lets reviewers file accessibility bugs from the review screen. Each
          person adds their own Jira token in their profile, so bugs are filed
          as them. A shared token here is optional: it is used for people who
          have not added one.
        </Typography>
      )}
      <TextField
        id="jiraUrl"
        label="Jira URL"
        placeholder="https://jira.example.com"
        size="small"
        value={project.jiraUrl ?? ""}
        onChange={(event) => update({ jiraUrl: event.target.value })}
      />
      <SecretField
        id="jiraToken"
        label="Shared token (optional)"
        saved={tokenSaved}
        value={project.jiraToken}
        onChange={(jiraToken) => update({ jiraToken })}
      />
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

/**
 * UI tree comparison settings. The settings page shows them as a section of
 * its own, under its own heading (`bare`). Element rules are added on the
 * review screen, where the element can be picked on the screenshot (019).
 */
export const MobileSettings: React.FunctionComponent<{
  bare?: boolean;
}> = ({ bare = false }) => {
  const { projectEditState: project } = useProjectState();
  const projectDispatch = useProjectDispatch();
  const settings = parseUiTreeSettings(project.uiTreeSettings);
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

  return (
    <Box
      sx={{
        mt: bare ? 0 : 3,
        display: "flex",
        flexDirection: "column",
        gap: 1,
      }}
    >
      {!bare && <Divider />}
      {!bare && (
        <Typography variant="subtitle1">
          Mobile screenshots (UI tree)
        </Typography>
      )}
      {!bare && (
        <Typography variant="body2" color="textSecondary">
          Applies to screenshots sent with an Appium page source.
        </Typography>
      )}
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
          sx={{
            alignItems: "flex-start",
            "& .MuiSwitch-root": { mt: -0.5 },
          }}
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
    </Box>
  );
};
