import React, { FunctionComponent } from "react";
import {
  Box,
  MenuItem,
  Select,
  TextField,
  Tooltip,
  Typography,
  type SelectChangeEvent,
} from "@mui/material";
import { Add, Check, FolderOutlined, UnfoldMore } from "@mui/icons-material";
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
import { projectSwitcherState } from "../_helpers/sideNav.helper";

// the roles the API lets create projects
const PROJECT_CREATOR_ROLES = new Set<User["role"]>(["admin", "editor"]);
// a value no project id can take: picking it opens the create dialog instead
const NEW_PROJECT = "__new-project__";
// read by screen readers, not drawn: the folded sidebar has no room for it
const HIDDEN = {
  position: "absolute",
  width: "1px",
  height: "1px",
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
} as const;

// up and down: the switcher opens a list, as in the account button below it
const SwitcherIcon = (props: { className?: string }) => (
  <UnfoldMore
    {...props}
    sx={{ width: 16, height: 16, color: tokens.textMuted }}
  />
);

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
  /** the switcher of the sidebar (spec 046): always there, says why it is empty */
  sidebar?: boolean;
  /** the sidebar folded to icons: the project's letter alone */
  folded?: boolean;
}> = ({
  projectId,
  onProjectSelect,
  compact = false,
  sidebar = false,
  folded = false,
}) => {
  const { t } = useT();
  const navigate = useNavigate();
  const { projectList, selectedProjectId } = useProjectState();
  const { user } = useUserState();
  const projectDispatch = useProjectDispatch();
  const canCreate = !compact && !!user && PROJECT_CREATOR_ROLES.has(user.role);
  // one switcher owns the ids the tour and the label point at
  const selectId = sidebar ? "project-select" : "page-project-select";
  const labelId = sidebar ? "projectSelect" : "pageProjectSelect";

  React.useEffect(() => {
    if (projectId && projectId !== selectedProjectId) {
      selectProject(projectDispatch, projectId);
    }
  }, [projectId, selectedProjectId, projectDispatch]);

  const state = projectSwitcherState(projectList, selectedProjectId);

  if (projectList.length === 0 && !sidebar) {
    return null;
  }

  const nameOf = (id: unknown) =>
    projectList.find((project) => project.id === id)?.name;

  const placeholder = (
    <Box component="span" sx={{ color: tokens.textMuted }}>
      {sidebar ? t("nav.chooseProject") : t("filters.selectProject")}
    </Box>
  );

  const caption = (
    <Typography
      id={labelId}
      component="label"
      htmlFor={selectId}
      sx={{
        display: "block",
        mb: 0.75,
        mx: sidebar ? 1 : 0,
        fontSize: type.caption,
        fontWeight: 600,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        color: tokens.textMuted,
        ...(folded && HIDDEN),
      }}
    >
      {sidebar ? t("nav.project") : t("filters.project")}
    </Typography>
  );

  // nothing to choose from: the box stays, so the menu does not jump (REQ-046-27)
  if (sidebar && state.kind === "noProjects") {
    return (
      <Box data-testid="projectSwitcher">
        {caption}
        <Tooltip title={folded ? t(state.label) : ""} placement="right">
          <Box
            id={selectId}
            aria-disabled="true"
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: folded ? "center" : "flex-start",
              gap: 1,
              height: 40,
              px: folded ? 0 : 1.25,
              borderRadius: radius.control,
              border: `1px dashed ${tokens.border}`,
              color: tokens.textMuted,
              fontSize: type.body,
            }}
          >
            {folded ? (
              <FolderOutlined fontSize="small" aria-label={t(state.label)} />
            ) : (
              t(state.label)
            )}
          </Box>
        </Tooltip>
      </Box>
    );
  }

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
          id: selectId,
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

  const select = (
    <Select
      id={selectId}
      labelId={labelId}
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
        if (folded) {
          return name ? (
            <ProjectAvatar name={name} size={22} />
          ) : (
            <FolderOutlined
              fontSize="small"
              sx={{ display: "block", color: tokens.textMuted }}
            />
          );
        }
        return name ? (
          <Box component="span" sx={{ fontWeight: 600 }}>
            <ProjectName name={name} size={sidebar ? 22 : 30} />
          </Box>
        ) : (
          placeholder
        );
      }}
      IconComponent={sidebar ? SwitcherIcon : undefined}
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
        ...(sidebar && {
          height: 40,
          fontSize: type.body,
          "& .MuiSelect-select": {
            py: 0,
            pl: folded ? 0 : 1.25,
            pr: folded ? "0 !important" : undefined,
            display: "flex",
            alignItems: "center",
            justifyContent: folded ? "center" : "flex-start",
            minHeight: "unset",
          },
          "& .MuiSelect-icon": { display: folded ? "none" : undefined },
        }),
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
  );

  if (sidebar) {
    return (
      <Box data-testid="projectSwitcher">
        {caption}
        <Tooltip
          title={
            folded
              ? state.kind === "project"
                ? state.name
                : t("nav.chooseProject")
              : ""
          }
          placement="right"
        >
          <Box>{select}</Box>
        </Tooltip>
      </Box>
    );
  }

  return (
    <Box sx={{ pb: 1 }}>
      {caption}
      {select}
    </Box>
  );
};

export default ProjectSelect;
