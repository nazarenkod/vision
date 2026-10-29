import React, { useEffect } from "react";
import {
  Typography,
  IconButton,
  Button,
  Box,
  TextField,
  InputAdornment,
  Link as MuiLink,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import { Link, useNavigate } from "react-router-dom";
import { StatusPill } from "../components/StatusPill";
import { tokens } from "../theme";
import {
  useProjectState,
  useProjectDispatch,
  deleteProject,
  createProject,
  setProjectEditState,
  useHelpDispatch,
  setHelpSteps,
  useUserState,
} from "../contexts";
import { Delete, Add, Edit, Search } from "@mui/icons-material";
import {
  routes,
  LOCATOR_PROJECT_LIST_PAGE_PROJECT_LIST,
  PROJECT_LIST_PAGE_STEPS,
} from "../constants";
import { NewProjectFields } from "../components/ProjectForm";
import { buildProjectSettingsUrl } from "../_helpers/route.helpers";
import { deleteConfirmed } from "../_helpers/projectSettings.helper";
import { useSnackbar } from "notistack";
import { BaseModal } from "../components/BaseModal";
import { User } from "../types";
import { useT } from "../i18n";

// the roles the API lets create, update and delete projects
const PROJECT_EDITOR_ROLES = new Set<User["role"]>(["admin", "editor"]);

const ProjectsListPage = () => {
  const { enqueueSnackbar } = useSnackbar();
  const { t, tx, formatDate } = useT();
  const projectState = useProjectState();
  const projectDispatch = useProjectDispatch();
  const helpDispatch = useHelpDispatch();
  const { user } = useUserState();
  const canEditProjects = !!user && PROJECT_EDITOR_ROLES.has(user.role);

  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [typedName, setTypedName] = React.useState("");
  const navigate = useNavigate();
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  useEffect(() => {
    setHelpSteps(helpDispatch, PROJECT_LIST_PAGE_STEPS);
  });

  const toggleCreateDialogOpen = () => {
    setCreateDialogOpen(!createDialogOpen);
  };

  const toggleDeleteDialogOpen = () => {
    setDeleteDialogOpen(!deleteDialogOpen);
  };

  const filtered = projectState.projectList.filter((project) =>
    project.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <Box
      sx={{
        px: 4,
        py: 3,
        display: "flex",
        flexDirection: "column",
        gap: 2.5,
        maxWidth: 1280,
      }}
    >
      <Typography variant="h4" component="h1">
        {t("projectList.title")}
      </Typography>
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-end",
          gap: 2,
        }}
      >
        <TextField
          id="projectSearch"
          size="small"
          label={t("projectList.search")}
          placeholder={t("projectList.searchPlaceholder")}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          sx={{ width: 320, bgcolor: tokens.surface }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
        <Box sx={{ flex: 1 }} />
        {canEditProjects && (
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => {
              toggleCreateDialogOpen();
              setProjectEditState(projectDispatch);
            }}
          >
            {t("projectList.add")}
          </Button>
        )}
      </Box>
      <TableContainer
        id={LOCATOR_PROJECT_LIST_PAGE_PROJECT_LIST}
        sx={{
          bgcolor: tokens.surface,
          border: `1px solid ${tokens.border}`,
          borderRadius: 3,
        }}
      >
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>{t("projectList.project")}</TableCell>
              <TableCell>{t("projectList.mainBranch")}</TableCell>
              <TableCell>{t("projectList.comparison")}</TableCell>
              <TableCell>{t("projectList.jira")}</TableCell>
              <TableCell>{t("projectList.created")}</TableCell>
              <TableCell align="right">{t("projectList.actions")}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((project) => (
              <TableRow key={project.id} hover>
                <TableCell>
                  <MuiLink
                    component={Link}
                    to={`${routes.HOME}${project.id}`}
                    sx={{ fontWeight: 600 }}
                  >
                    {project.name}
                  </MuiLink>
                  <Typography
                    sx={{
                      font: `400 11px ${tokens.mono}`,
                      color: tokens.textMuted,
                    }}
                  >
                    {project.id}
                  </Typography>
                </TableCell>
                <TableCell sx={{ fontFamily: tokens.mono, fontSize: 13 }}>
                  {project.mainBranchName}
                </TableCell>
                <TableCell>{project.imageComparison}</TableCell>
                <TableCell>
                  {project.jiraUrl && project.jiraTokenSet ? (
                    <StatusPill
                      tone="passed"
                      label={t("projectList.jiraConnected")}
                    />
                  ) : (
                    <StatusPill
                      tone="neutral"
                      label={t("projectList.jiraNotSet")}
                    />
                  )}
                </TableCell>
                <TableCell>{formatDate(project.createdAt)}</TableCell>
                <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                  <Button
                    size="small"
                    component={Link}
                    to={`${routes.HOME}${project.id}`}
                  >
                    {t("projectList.builds")}
                  </Button>
                  <Button
                    size="small"
                    component={Link}
                    to={`${routes.VARIATION_LIST_PAGE}/${project.id}`}
                  >
                    {t("projectList.baselines")}
                  </Button>
                  {canEditProjects && (
                    <>
                      <IconButton
                        aria-label={t("projectList.editOf", {
                          name: project.name,
                        })}
                        onClick={() =>
                          navigate(buildProjectSettingsUrl(project.id))
                        }
                      >
                        <Edit fontSize="small" />
                      </IconButton>
                      <IconButton
                        aria-label={t("projectList.deleteOf", {
                          name: project.name,
                        })}
                        onClick={() => {
                          setTypedName("");
                          toggleDeleteDialogOpen();
                          setProjectEditState(projectDispatch, project);
                        }}
                        data-testid="delete"
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!filtered.length && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  sx={{
                    color: tokens.textSecondary,
                    textAlign: "center",
                    py: 4,
                  }}
                >
                  {search
                    ? t("projectList.noMatch", { search })
                    : t("projectList.empty")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      {canEditProjects && (
        <>
          <BaseModal
            open={createDialogOpen}
            title={t("projectList.createTitle")}
            submitButtonText={t("projectList.create")}
            onCancel={toggleCreateDialogOpen}
            content={<NewProjectFields />}
            onSubmit={() =>
              createProject(projectDispatch, projectState.projectEditState)
                .then((project) => {
                  toggleCreateDialogOpen();
                  enqueueSnackbar(
                    t("projectList.createdToast", { name: project.name }),
                    {
                      variant: "success",
                    },
                  );
                  // the rest of the setup is on its settings page (REQ-018-52)
                  navigate(buildProjectSettingsUrl(project.id));
                })
                .catch((err) =>
                  enqueueSnackbar(err, {
                    variant: "error",
                  }),
                )
            }
          />

          <BaseModal
            open={deleteDialogOpen}
            title={t("deleteProject.title", {
              name: projectState.projectEditState.name,
            })}
            submitButtonText={t("deleteProject.submit")}
            onCancel={toggleDeleteDialogOpen}
            // the name typed in, as on the settings page (REQ-018-49)
            submitDisabled={
              !deleteConfirmed(projectState.projectEditState.name, typedName)
            }
            content={
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                <Typography>
                  {tx("deleteProject.confirm", {
                    name: <b>{projectState.projectEditState.name}</b>,
                  })}
                </Typography>
                <TextField
                  size="small"
                  value={typedName}
                  onChange={(event) => setTypedName(event.target.value)}
                  inputProps={{
                    "aria-label": t("deleteProject.nameLabel"),
                    "data-testid": "deleteConfirmName",
                  }}
                />
              </Box>
            }
            onSubmit={() =>
              deleteProject(projectDispatch, projectState.projectEditState.id)
                .then((project) => {
                  toggleDeleteDialogOpen();
                  enqueueSnackbar(
                    t("projectList.deletedToast", { name: project.name }),
                    {
                      variant: "success",
                    },
                  );
                })
                .catch((err) =>
                  enqueueSnackbar(err, {
                    variant: "error",
                  }),
                )
            }
          />
        </>
      )}
    </Box>
  );
};

export default ProjectsListPage;
