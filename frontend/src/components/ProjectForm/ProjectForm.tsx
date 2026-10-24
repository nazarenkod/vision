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
        Lets reviewers file accessibility bugs from the review screen. Server
        and Data Center use a personal access token; Jira Cloud uses your
        account email with an API token.
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
        label="Token"
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
        label="Account email (Jira Cloud only)"
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
