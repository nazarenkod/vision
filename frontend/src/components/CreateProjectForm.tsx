import React from "react";
import { Typography } from "@mui/material";
import { TextValidator } from "react-material-ui-form-validator";
import {
  setProjectEditState,
  useProjectDispatch,
  useProjectState,
} from "../contexts";
import { useT } from "../i18n";

/** A new project needs a name and a branch; the rest starts at its defaults. */
export const CreateProjectForm: React.FunctionComponent = () => {
  const { t } = useT();
  const { projectEditState: project } = useProjectState();
  const dispatch = useProjectDispatch();

  return (
    <>
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
          setProjectEditState(dispatch, {
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
        helperText={t("general.mainBranchHelp")}
        type="text"
        fullWidth
        required
        value={project.mainBranchName}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
          setProjectEditState(dispatch, {
            ...project,
            mainBranchName: event.target.value,
          })
        }
      />
      <Typography variant="body2" color="textSecondary" sx={{ mt: 1.5 }}>
        {t("projectList.createHint")}
      </Typography>
    </>
  );
};
