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
import { motion, tokens } from "../../theme";
import { LooksSameConfigForm } from "./LooksSameConfigForm";
import { OdiffConfigForm } from "./OdiffConfigForm";
import { PixelmatchConfigForm } from "./PixelmatchConfigForm";
import { VlmConfigForm } from "./VlmConfigForm";
import { getDefaultConfig } from "./utils";
import { UiTreeSettings, parseUiTreeSettings } from "../../types/insights";
import { A11yRulesSettings } from "./A11yRulesSettings";
import { SecretField } from "./SecretField";
import { MessageKey, useT } from "../../i18n";

// what each engine is for, in one sentence (REQ-018-44)
const ENGINES: Array<[ImageComparison, MessageKey]> = [
  [ImageComparison.pixelmatch, "comparison.pixelmatchHelp"],
  [ImageComparison.lookSame, "comparison.lookSameHelp"],
  [ImageComparison.odiff, "comparison.odiffHelp"],
  [ImageComparison.vlm, "comparison.vlmHelp"],
];

const useEditedProject = () => {
  const { projectEditState: project } = useProjectState();
  const projectDispatch = useProjectDispatch();
  return { project, projectDispatch };
};

/** Name, main branch and how long builds are kept. */
export const GeneralFields: React.FunctionComponent = () => {
  const { project, projectDispatch } = useEditedProject();
  const { t } = useT();
  return (
    <React.Fragment>
      <TextValidator
        name="projectName"
        validators={["minStringLength:2"]}
        errorMessages={[t("validation.twoCharacters")]}
        margin="dense"
        id="name"
        label={t("general.name")}
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
        errorMessages={[t("validation.twoCharacters")]}
        margin="dense"
        id="branchName"
        label={t("general.mainBranch")}
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
        errorMessages={[t("validation.greaterThan", { min: 1 })]}
        InputProps={{
          inputProps: {
            min: 1,
            step: 1,
          },
        }}
        margin="dense"
        id="buildCount"
        label={t("general.buildCount")}
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
        errorMessages={[t("validation.greaterThan", { min: 1 })]}
        InputProps={{
          inputProps: {
            min: 1,
            step: 1,
          },
        }}
        margin="dense"
        id="maxBranchLifetime"
        label={t("general.branchLifetime")}
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

/** The review settings: auto approve. */
export const ReviewFields: React.FunctionComponent = () => {
  const { project, projectDispatch } = useEditedProject();
  const { t } = useT();
  return (
    <React.Fragment>
      <FormControlLabel
        label={t("review.autoApprove")}
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
  const { t } = useT();
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
            {t("comparison.library")}
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
        aria-label={t("comparison.engines")}
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
                {t(description)}
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
  const { t } = useT();
  return (
    <React.Fragment>
      <TextValidator
        name="projectName"
        validators={["minStringLength:2"]}
        errorMessages={[t("validation.twoCharacters")]}
        margin="dense"
        id="name"
        label={t("general.name")}
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
        errorMessages={[t("validation.twoCharacters")]}
        margin="dense"
        id="branchName"
        label={t("general.mainBranch")}
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
        {t("general.newProjectHint")}
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
    <A11yRulesSettings />
    <JiraSettings />
  </React.Fragment>
);

/** Jira connection used to file accessibility bugs from the review screen. */
export const JiraSettings: React.FunctionComponent<{ bare?: boolean }> = ({
  bare = false,
}) => {
  const { projectEditState: project } = useProjectState();
  const projectDispatch = useProjectDispatch();
  const { t } = useT();
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
      {!bare && <Typography variant="subtitle1">{t("jira.title")}</Typography>}
      {!bare && (
        <Typography variant="body2" color="textSecondary">
          {t("jira.intro")}
        </Typography>
      )}
      <TextField
        id="jiraUrl"
        label={t("jira.url")}
        placeholder="https://jira.example.com"
        size="small"
        value={project.jiraUrl ?? ""}
        onChange={(event) => update({ jiraUrl: event.target.value })}
      />
      <SecretField
        id="jiraToken"
        label={t("jira.token")}
        saved={tokenSaved}
        value={project.jiraToken}
        onChange={(jiraToken) => update({ jiraToken })}
      />
      <TextField
        id="jiraEmail"
        label={t("jira.email")}
        size="small"
        value={project.jiraEmail ?? ""}
        onChange={(event) => update({ jiraEmail: event.target.value })}
      />
      <Box sx={{ display: "flex", gap: 1.5 }}>
        <TextField
          id="jiraIssueType"
          label={t("jira.issueType")}
          placeholder="Bug"
          size="small"
          fullWidth
          value={project.jiraIssueType ?? ""}
          onChange={(event) => update({ jiraIssueType: event.target.value })}
        />
        <TextField
          id="jiraLinkType"
          label={t("jira.linkType")}
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

const TOGGLES: Array<[keyof UiTreeSettings, MessageKey, MessageKey]> = [
  ["excludeSystemBars", "mobile.systemBars", "mobile.systemBarsHelp"],
  ["compensateMoves", "mobile.moves", "mobile.movesHelp"],
  ["detectSemanticChanges", "mobile.hidden", "mobile.hiddenHelp"],
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
  const { t } = useT();
  const settings = parseUiTreeSettings(project.uiTreeSettings);
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
        <Typography variant="subtitle1">{t("mobile.title")}</Typography>
      )}
      {!bare && (
        <Typography variant="body2" color="textSecondary">
          {t("section.mobileIntro")}
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
              <Typography variant="body2">{t(label)}</Typography>
              <Typography variant="caption" color="textSecondary">
                {t(help)}
              </Typography>
            </Box>
          }
          sx={{
            alignItems: "flex-start",
            "& .MuiSwitch-root": { mt: -0.5 },
          }}
        />
      ))}
      {settings.compensateMoves && (
        <TextField
          id="maxMoveDp"
          size="small"
          type="number"
          label={t("mobile.maxMove")}
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
