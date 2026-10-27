import React from "react";
import {
  Alert,
  Badge,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link as MuiLink,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import { ArrowBack } from "@mui/icons-material";
import {
  Link,
  Navigate,
  useBlocker,
  useNavigate,
  useParams,
} from "react-router-dom";
import { useSnackbar } from "notistack";
import {
  selectProject,
  setProjectEditState,
  updateProject,
  useProjectDispatch,
  useProjectState,
  useUserState,
} from "../contexts";
import { MessageKey, useT } from "../i18n";
import { projectSettingsPath, routes } from "../constants";
import { ProjectDto, User } from "../types";
import { tokens } from "../theme";
import {
  AccessibilityTab,
  ComparisonTab,
  FieldErrorsContext,
  GeneralTab,
  JiraTab,
  MobileTab,
  SETTINGS_TABS,
  SettingsTab,
  VocabularyContext,
  settingsDiffer,
  useLoadVocabulary,
  validateProject,
} from "../components/ProjectSettings";
import { FieldError } from "../components/ProjectSettings/validation";

// the roles the API lets change projects
const PROJECT_EDITOR_ROLES = new Set<User["role"]>(["admin", "editor"]);

const TAB_LABELS: Record<SettingsTab, MessageKey> = {
  general: "settings.tab.general",
  comparison: "settings.tab.comparison",
  mobile: "settings.tab.mobile",
  accessibility: "settings.tab.accessibility",
  jira: "settings.tab.jira",
};

const TAB_CONTENT: Record<SettingsTab, React.FunctionComponent> = {
  general: GeneralTab,
  comparison: ComparisonTab,
  mobile: MobileTab,
  accessibility: AccessibilityTab,
  jira: JiraTab,
};

const ProjectSettingsPage: React.FunctionComponent = () => {
  const { t } = useT();
  const { projectId = "", tab: tabParam } = useParams();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { projectList, projectEditState: draft } = useProjectState();
  const dispatch = useProjectDispatch();
  const { user } = useUserState();
  const canEdit = !!user && PROJECT_EDITOR_ROLES.has(user.role);
  const project = projectList.find((item) => item.id === projectId);
  const tab = (SETTINGS_TABS as string[]).includes(tabParam ?? "")
    ? (tabParam as SettingsTab)
    : "general";

  // the project as last loaded or saved, to tell what changed since
  const [saved, setSaved] = React.useState<ProjectDto | null>(null);
  const [showErrors, setShowErrors] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [focusField, setFocusField] = React.useState<string | null>(null);

  React.useEffect(() => {
    selectProject(dispatch, projectId);
  }, [dispatch, projectId]);

  React.useEffect(() => {
    if (project && saved?.id !== project.id) {
      setSaved(project as ProjectDto);
      setProjectEditState(dispatch, project as ProjectDto);
      setShowErrors(false);
    }
  }, [project, saved?.id, dispatch]);

  const ready = !!saved && draft.id === saved.id;
  const dirty = ready && canEdit && settingsDiffer(draft, saved);
  const errors = ready ? validateProject(draft) : [];
  const shownErrors: FieldError[] = showErrors ? errors : [];

  const vocabulary = useLoadVocabulary(
    projectId,
    tab === "mobile" || tab === "accessibility",
  );

  const settingsBase = projectSettingsPath(projectId);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty &&
      !saving &&
      currentLocation.pathname !== nextLocation.pathname &&
      !nextLocation.pathname.startsWith(settingsBase),
  );

  React.useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // older browsers show the prompt only when this is set
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // the cursor goes to the first wrong field once its tab is on screen
  React.useEffect(() => {
    if (!focusField) return;
    const element = document.getElementById(focusField);
    if (element) {
      element.scrollIntoView({ block: "center" });
      element.focus();
      setFocusField(null);
    }
  }, [focusField, tab]);

  if (!project) {
    return projectList.length ? (
      <Navigate to={routes.PROJECT_LIST_PAGE} replace />
    ) : null;
  }

  const save = () => {
    if (errors.length) {
      setShowErrors(true);
      const first = errors[0];
      if (first.tab !== tab)
        navigate(projectSettingsPath(projectId, first.tab));
      setFocusField(first.field);
      return;
    }
    setSaving(true);
    updateProject(dispatch, draft)
      .then((result) => {
        setSaved(result as ProjectDto);
        setProjectEditState(dispatch, result as ProjectDto);
        setShowErrors(false);
        enqueueSnackbar(t("settings.saved", { name: result.name }), {
          variant: "success",
        });
      })
      .catch((err) => enqueueSnackbar(err, { variant: "error" }))
      .finally(() => setSaving(false));
  };

  const Content = TAB_CONTENT[tab];
  const errorsOn = (name: SettingsTab) =>
    shownErrors.filter((error) => error.tab === name).length;

  return (
    <Box
      sx={{
        px: 4,
        py: 3,
        display: "flex",
        flexDirection: "column",
        gap: 2,
        maxWidth: 1040,
      }}
    >
      <MuiLink
        component={Link}
        to={routes.PROJECT_LIST_PAGE}
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: 0.5,
          fontSize: 14,
        }}
      >
        <ArrowBack fontSize="small" />
        {t("settings.backToProjects")}
      </MuiLink>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          flexWrap: "wrap",
          position: "sticky",
          top: 0,
          zIndex: 2,
          bgcolor: tokens.ground,
          py: 1,
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h4" component="h1">
            {t("settings.title")}
          </Typography>
          <Typography color="textSecondary">{project.name}</Typography>
        </Box>
        {canEdit && (
          <>
            {dirty && (
              <Typography
                variant="body2"
                color="textSecondary"
                data-testid="unsavedChanges"
              >
                {t("settings.unsaved")}
              </Typography>
            )}
            <Button
              disabled={!dirty || saving}
              onClick={() => saved && setProjectEditState(dispatch, saved)}
            >
              {t("settings.discard")}
            </Button>
            <Button
              variant="contained"
              disabled={!dirty || saving}
              onClick={save}
              data-testid="saveSettings"
            >
              {t("settings.save")}
            </Button>
          </>
        )}
      </Box>
      {!canEdit && <Alert severity="info">{t("settings.readOnly")}</Alert>}
      {showErrors && errors.length > 0 && (
        <Alert severity="error">
          {t("settings.hasErrors", { count: errors.length })}
        </Alert>
      )}
      <Tabs
        value={tab}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ borderBottom: `1px solid ${tokens.border}` }}
      >
        {SETTINGS_TABS.map((name) => (
          <Tab
            key={name}
            value={name}
            component={Link}
            to={projectSettingsPath(projectId, name)}
            data-testid={`settingsTab-${name}`}
            label={
              <Badge
                color="error"
                badgeContent={errorsOn(name)}
                invisible={!errorsOn(name)}
                sx={{ "& .MuiBadge-badge": { right: -12 } }}
              >
                {t(TAB_LABELS[name])}
              </Badge>
            }
          />
        ))}
      </Tabs>
      {ready && (
        <FieldErrorsContext.Provider value={shownErrors}>
          <VocabularyContext.Provider value={vocabulary}>
            <Box
              component="fieldset"
              disabled={!canEdit}
              sx={{
                border: 0,
                p: 0,
                m: 0,
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                gap: 2,
              }}
            >
              <Content />
            </Box>
          </VocabularyContext.Provider>
        </FieldErrorsContext.Provider>
      )}
      <Dialog
        open={blocker.state === "blocked"}
        onClose={() => blocker.reset?.()}
      >
        <DialogTitle>{t("settings.leaveTitle")}</DialogTitle>
        <DialogContent>
          <Typography>{t("settings.leaveText")}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => blocker.reset?.()}>
            {t("settings.stay")}
          </Button>
          <Button
            color="error"
            onClick={() => {
              if (saved) setProjectEditState(dispatch, saved);
              blocker.proceed?.();
            }}
            data-testid="leaveWithoutSaving"
          >
            {t("settings.leave")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProjectSettingsPage;
