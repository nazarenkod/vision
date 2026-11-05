import React, { FunctionComponent } from "react";
import {
  Box,
  MenuItem,
  Select,
  TextField,
  Typography,
  type SelectChangeEvent,
} from "@mui/material";
import { Add, Check } from "@mui/icons-material";
import { useNavigate } from "react-router";
import {
  useProjectState,
  useProjectDispatch,
  useUserState,
  selectProject,
} from "../contexts";
import { tokens, type, radius } from "../theme";
import { pillField } from "./pillField";
import { ProjectAvatar } from "./ProjectAvatar";
import { routes } from "../constants";
import { User } from "../types";
import { useT } from "../i18n";

// the roles the API lets create projects
const PROJECT_CREATOR_ROLES = new Set<User["role"]>(["admin", "editor"]);
// a value no project id can take: picking it opens the create dialog instead
const NEW_PROJECT = "__new-project__";

const ProjectName: FunctionComponent<{ name: string; size?: number }> = ({
  name,
  size,
}) => (
  <Box
    component="span"
    sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0 }}
  >
    <ProjectAvatar name={name} size={size} />
    <Box
      component="span"
      sx={{
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
    >
      {name}
    </Box>
  </Box>
);

const ProjectSelect: FunctionComponent<{
  projectId?: string;
  onProjectSelect: (id: string) => void;
  /** a rounded field beside a page's heading, as the filters below it */
  compact?: boolean;
}> = ({ projectId, onProjectSelect, compact = false }) => {
  const { t } = useT();
  const navigate = useNavigate();
  const { projectList, selectedProjectId } = useProjectState();
  const { user } = useUserState();
  const projectDispatch = useProjectDispatch();
  const canCreate = !compact && !!user && PROJECT_CREATOR_ROLES.has(user.role);

  React.useEffect(() => {
    if (projectId && projectId !== selectedProjectId) {
      selectProject(projectDispatch, projectId);
    }
  }, [projectId, selectedProjectId, projectDispatch]);

  if (projectList.length === 0) {
    return null;
  }

  const nameOf = (id: unknown) =>
    projectList.find((project) => project.id === id)?.name;

  const placeholder = (
    <Box component="span" sx={{ color: tokens.textMuted }}>
      {t("filters.selectProject")}
    </Box>
  );

  const options = projectList.map((project) => (
    <MenuItem
      key={project.id}
      value={project.id}
      sx={{ gap: 1, py: compact ? 0.75 : 1 }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <ProjectName name={project.name} size={compact ? 22 : 28} />
      </Box>
      {project.id === selectedProjectId && (
        <Check fontSize="small" sx={{ color: tokens.brand }} />
      )}
    </MenuItem>
  ));

  if (compact) {
    return (
      <TextField
        select
        size="small"
        label={t("filters.project")}
        value={selectedProjectId ?? ""}
        onChange={(event) => onProjectSelect(event.target.value)}
        SelectProps={{
          id: "project-select",
          displayEmpty: true,
          renderValue: (selected) => {
            const name = nameOf(selected);
            return name ? <ProjectName name={name} size={20} /> : placeholder;
          },
        }}
        InputLabelProps={{ shrink: true }}
        sx={{ minWidth: 200, maxWidth: 320, ...pillField() }}
      >
        {options}
      </TextField>
    );
  }

  return (
    <Box sx={{ pb: 1 }}>
      <Typography
        id="projectSelect"
        component="label"
        htmlFor="project-select"
        sx={{
          display: "block",
          mb: 0.75,
          fontSize: type.caption,
          fontWeight: 600,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: tokens.textMuted,
        }}
      >
        {t("filters.project")}
      </Typography>
      <Select
        id="project-select"
        labelId="projectSelect"
        fullWidth
        displayEmpty
        value={selectedProjectId ?? ""}
        onChange={(event: SelectChangeEvent<string>) => {
          if (event.target.value === NEW_PROJECT) {
            navigate(`${routes.PROJECT_LIST_PAGE}?create=1`);
            return;
          }
          onProjectSelect(event.target.value);
        }}
        renderValue={(selected) => {
          const name = nameOf(selected);
          return name ? (
            <Box component="span" sx={{ fontWeight: 600 }}>
              <ProjectName name={name} size={30} />
            </Box>
          ) : (
            placeholder
          );
        }}
        MenuProps={{
          anchorOrigin: { vertical: "bottom", horizontal: "left" },
          transformOrigin: { vertical: "top", horizontal: "left" },
          slotProps: {
            paper: {
              sx: {
                mt: 0.75,
                borderRadius: radius.control,
                border: `1px solid ${tokens.border}`,
                boxShadow: tokens.shadowPop,
                "& .MuiMenuItem-root.Mui-selected": {
                  bgcolor: tokens.brandSoft,
                },
              },
            },
          },
        }}
        sx={{
          borderRadius: radius.control,
          bgcolor: tokens.surface,
          "& .MuiSelect-select": { py: 1, pl: 1.25 },
          "& .MuiOutlinedInput-notchedOutline": { borderColor: tokens.border },
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: tokens.borderStrong,
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: tokens.brand,
            borderWidth: 1,
          },
          "&.Mui-focused": { boxShadow: `0 0 0 3px ${tokens.brandSoft}` },
        }}
      >
        {options}
        {canCreate && (
          <MenuItem
            value={NEW_PROJECT}
            data-testid="projectSelectCreate"
            sx={{
              gap: 1,
              mt: 0.5,
              borderTop: `1px solid ${tokens.border}`,
              color: tokens.brand,
              fontWeight: 500,
            }}
          >
            <Add fontSize="small" />
            {t("projectSelect.newProject")}
          </MenuItem>
        )}
      </Select>
    </Box>
  );
};

export default ProjectSelect;
