import React, { FunctionComponent } from "react";
import { makeStyles, createStyles } from "@mui/styles";
import {
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  type Theme,
  type SelectChangeEvent,
} from "@mui/material";
import {
  useProjectState,
  useProjectDispatch,
  selectProject,
} from "../contexts";
import { tokens } from "../theme";
import { pillField } from "./pillField";

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    formControl: {
      width: "100%",
    },
    input: {
      margin: theme.spacing(1),
    },
    // the label is positioned against the form control rather than the input,
    // so without the input's own inset it sits on the sidebar's edge
    label: {
      marginLeft: theme.spacing(1),
    },
  }),
);

const ProjectSelect: FunctionComponent<{
  projectId?: string;
  onProjectSelect: (id: string) => void;
  /** a rounded field beside a page's heading, as the filters below it */
  compact?: boolean;
}> = ({ projectId, onProjectSelect, compact = false }) => {
  const classes = useStyles();
  const { projectList, selectedProjectId } = useProjectState();
  const projectDispatch = useProjectDispatch();

  React.useEffect(() => {
    if (projectId && projectId !== selectedProjectId) {
      selectProject(projectDispatch, projectId);
    }
  }, [projectId, selectedProjectId, projectDispatch]);

  if (compact) {
    return projectList.length > 0 ? (
      <TextField
        select
        size="small"
        label="Project"
        value={selectedProjectId ?? ""}
        onChange={(event) => onProjectSelect(event.target.value)}
        SelectProps={{
          id: "project-select",
          displayEmpty: true,
          renderValue: (selected) =>
            projectList.find((project) => project.id === selected)?.name ?? (
              <Box component="span" sx={{ color: tokens.textMuted }}>
                Select project
              </Box>
            ),
        }}
        InputLabelProps={{ shrink: true }}
        sx={{ minWidth: 200, maxWidth: 320, ...pillField() }}
      >
        {projectList.map((project) => (
          <MenuItem key={project.id} value={project.id}>
            {project.name}
          </MenuItem>
        ))}
      </TextField>
    ) : null;
  }

  return (
    <>
      {projectList.length > 0 && (
        <FormControl variant="standard" className={classes.formControl}>
          <InputLabel id="projectSelect" className={classes.label} shrink>
            Project
          </InputLabel>
          <Select
            variant="standard"
            id="project-select"
            labelId="projectSelect"
            className={classes.input}
            displayEmpty
            value={selectedProjectId ?? ""}
            onChange={(event: SelectChangeEvent<HTMLInputElement>) =>
              onProjectSelect(event.target.value as string)
            }
          >
            <MenuItem value="" disabled>
              <em>Select project</em>
            </MenuItem>
            {projectList.map((project) => (
              <MenuItem key={project.id} value={project.id}>
                {project.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}
    </>
  );
};

export default ProjectSelect;
