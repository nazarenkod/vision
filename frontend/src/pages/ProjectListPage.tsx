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
  projectSettingsPath,
  LOCATOR_PROJECT_LIST_PAGE_PROJECT_LIST,
  PROJECT_LIST_PAGE_STEPS,
} from "../constants";
import { CreateProjectForm } from "../components/CreateProjectForm";
import { useT } from "../i18n";
import { useSnackbar } from "notistack";
import { BaseModal } from "../components/BaseModal";
import { User } from "../types";

// the roles the API lets create, update and delete projects
const PROJECT_EDITOR_ROLES = new Set<User["role"]>(["admin", "editor"]);

const ProjectsListPage = () => {
  const { enqueueSnackbar } = useSnackbar();
  const projectState = useProjectState();
  const projectDispatch = useProjectDispatch();
  const helpDispatch = useHelpDispatch();
  const { user } = useUserState();
  const { t, formatDate } = useT();
  const navigate = useNavigate();
  const canEditProjects = !!user && PROJECT_EDITOR_ROLES.has(user.role);

  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
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
              <TableCell>Jira</TableCell>
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
                        component={Link}
                        to={projectSettingsPath(project.id)}
                        aria-label={t("projectList.settingsOf", {
                          name: project.name,
                        })}
                        title={t("projectList.settings")}
                      >
                        <Edit fontSize="small" />
                      </IconButton>
                      <IconButton
                        aria-label={t("projectList.deleteOf", {
                          name: project.name,
                        })}
                        onClick={() => {
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
            content={<CreateProjectForm />}
            onSubmit={() =>
              createProject(projectDispatch, projectState.projectEditState)
                .then((project) => {
                  toggleCreateDialogOpen();
                  enqueueSnackbar(
                    t("projectList.createdToast", { name: project.name }),
                    { variant: "success" },
                  );
                  // everything but the name and branch starts at its default; tune it there
                  navigate(projectSettingsPath(project.id));
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
            title={t("projectList.deleteTitle")}
            submitButtonText={t("common.delete")}
            onCancel={toggleDeleteDialogOpen}
            content={
              <Typography>
                {t("projectList.deleteConfirm", {
                  name: projectState.projectEditState.name,
                })}
              </Typography>
            }
            onSubmit={() =>
              deleteProject(projectDispatch, projectState.projectEditState.id)
                .then((project) => {
                  toggleDeleteDialogOpen();
                  enqueueSnackbar(
                    t("projectList.deletedToast", { name: project.name }),
                    { variant: "success" },
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
