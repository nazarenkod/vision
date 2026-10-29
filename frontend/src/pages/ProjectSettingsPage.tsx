import React from "react";
import { useBlocker, useNavigate, useParams } from "react-router-dom";
import { useSnackbar } from "notistack";
import {
  Box,
  Button,
  ButtonBase,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  TextField,
  Typography,
} from "@mui/material";
import { ArrowBack, Check, Search } from "@mui/icons-material";
import { ValidatorForm } from "react-material-ui-form-validator";
import {
  deleteProject,
  getProjectList,
  selectProject,
  setProjectEditState,
  useProjectDispatch,
  useProjectState,
} from "../contexts";
import { projectsService, SettingsConflict } from "../services";
import { Project, ProjectDto } from "../types";
import { routes } from "../constants";
import { motion, tokens } from "../theme";
import {
  changedSections,
  deleteConfirmed,
  loadedSettings,
  matchSettings,
  SectionId,
  SETTINGS_SECTIONS,
} from "../_helpers/projectSettings.helper";
import {
  A11Y_RULES,
  a11yNormsOf,
  parseUiTreeSettings,
} from "../types/insights";
import {
  ComparisonFields,
  GeneralFields,
  JiraSettings,
  MobileSettings,
  ReviewFields,
} from "../components/ProjectForm";
import { A11yRulesSettings } from "../components/ProjectForm/A11yRulesSettings";
import { EmptyState } from "../components/EmptyState";
import { MessageKey, Text, useT } from "../i18n";

const DESCRIPTION: Partial<Record<SectionId, MessageKey>> = {
  comparison: "section.comparisonIntro",
  mobile: "section.mobileIntro",
  a11y: "section.a11yIntro",
  jira: "section.jiraIntro",
};

const asDto = (project: Project): ProjectDto => ({ ...project });

/** A short status beside each section in the contents. */
function sectionMeta(id: SectionId, project: ProjectDto, t: Text): string {
  const tree = parseUiTreeSettings(project.uiTreeSettings);
  switch (id) {
    case "comparison":
      return project.imageComparison;
    case "mobile": {
      const on = [
        tree.excludeSystemBars,
        tree.compensateMoves,
        tree.detectSemanticChanges,
        tree.detectLoading,
        tree.detectScreenMismatch,
      ].filter(Boolean).length;
      return t("settings.meta.mobileOn", { count: on });
    }
    case "a11y":
      return t("settings.meta.rulesOn", {
        count: A11Y_RULES.length - a11yNormsOf(tree).disabledRules.length,
        total: A11Y_RULES.length,
      });
    case "jira":
      return t(project.jiraUrl ? "settings.meta.set" : "settings.meta.notSet");
    default:
      return "";
  }
}

/**
 * A project's settings as a page of their own (018, US-5): contents and search
 * on the left, a card per section, an explicit save, and a guard against
 * leaving or overwriting someone else's changes.
 */
const ProjectSettingsPage: React.FunctionComponent = () => {
  const { projectId = "" } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { t, tx, language } = useT();
  const { projectList, projectEditState: edited } = useProjectState();
  const projectDispatch = useProjectDispatch();
  const saved = projectList.find((project) => project.id === projectId);

  // the settings as this page loaded them: what a save is checked against
  const [loaded, setLoaded] = React.useState<Project>();
  React.useEffect(() => {
    if (saved && loaded?.id !== saved.id) {
      setLoaded(saved);
      setProjectEditState(projectDispatch, asDto(saved));
      selectProject(projectDispatch, saved.id);
    }
  }, [saved, loaded?.id, projectDispatch]);

  const ready = !!loaded && edited.id === loaded.id;
  const changed = ready ? changedSections(loaded, edited, t) : [];
  const dirty = changed.length > 0;

  // ---- leaving with unsaved changes (REQ-018-48)
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && currentLocation.pathname !== nextLocation.pathname,
  );
  React.useEffect(() => {
    if (!dirty) return;
    const onUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [dirty]);

  // ---- search (REQ-018-43)
  const [query, setQuery] = React.useState("");
  const match = matchSettings(query, t);
  const sectionsRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const root = sectionsRef.current;
    if (!root) return;
    root
      .querySelectorAll(".v-hit")
      .forEach((el) => el.classList.remove("v-hit"));
    const wanted = query.trim().toLowerCase();
    if (!wanted) return;
    root
      .querySelectorAll(
        "label, .MuiFormControlLabel-label p, .MuiFormControlLabel-label, h2, summary",
      )
      .forEach((el) => {
        const own = Array.from(el.childNodes)
          .filter((node) => node.nodeType === Node.TEXT_NODE)
          .map((node) => node.textContent ?? "")
          .join("")
          .toLowerCase();
        if (own.includes(wanted)) el.classList.add("v-hit");
      });
    // the labels are new text in another language
  }, [query, ready, language]);

  // ---- contents follow the scroll (REQ-018-41)
  const [active, setActive] = React.useState<SectionId>("general");
  const pinned = React.useRef<SectionId>();
  const navButtons = React.useRef<
    Partial<Record<SectionId, HTMLElement | null>>
  >({});
  React.useEffect(() => {
    const root = sectionsRef.current;
    if (!root) return;
    const scroller = root.closest("main");
    if (!scroller) return;
    // the section being read is the last one whose top has passed the upper
    // third; the observer it replaces kept the section above lit while its
    // tail was still on screen, and never reached a short last section
    const update = () => {
      // a section picked in the rail stays lit while the page scrolls to it
      if (pinned.current) {
        setActive(pinned.current);
        return;
      }
      const sections = Array.from(
        root.querySelectorAll<HTMLElement>("[data-section]"),
      );
      if (!sections.length) return;
      const view = scroller.getBoundingClientRect();
      const atEnd =
        scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2;
      const line = view.top + view.height / 3;
      const current = atEnd
        ? sections[sections.length - 1]
        : (sections
            .filter((el) => el.getBoundingClientRect().top <= line)
            .pop() ?? sections[0]);
      setActive(current.getAttribute("data-section") as SectionId);
    };
    // the reader scrolling again lets the page decide
    const release = () => {
      if (!pinned.current) return;
      pinned.current = undefined;
      update();
    };
    update();
    scroller.addEventListener("scroll", update, { passive: true });
    scroller.addEventListener("wheel", release, { passive: true });
    scroller.addEventListener("touchstart", release, { passive: true });
    window.addEventListener("keydown", release);
    return () => {
      scroller.removeEventListener("scroll", update);
      scroller.removeEventListener("wheel", release);
      scroller.removeEventListener("touchstart", release);
      window.removeEventListener("keydown", release);
    };
  }, [ready, query]);
  const goTo = (id: SectionId) => {
    pinned.current = id;
    setActive(id);
    sectionsRef.current
      ?.querySelector(`[data-section='${id}']`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // ---- save, discard, conflicts (REQ-018-47, 53)
  const [saving, setSaving] = React.useState(false);
  const [justSaved, setJustSaved] = React.useState(false);
  const [conflict, setConflict] = React.useState<string[] | null>(null);
  const save = async (force = false) => {
    if (!loaded) return;
    setSaving(true);
    try {
      const project = await projectsService.updateSettings(
        edited,
        loadedSettings(loaded),
        force,
      );
      projectDispatch({ type: "update", payload: project });
      setLoaded(project);
      setProjectEditState(projectDispatch, asDto(project));
      setConflict(null);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1100);
    } catch (error) {
      if (error instanceof SettingsConflict) setConflict(error.fields);
      else enqueueSnackbar(String(error), { variant: "error" });
    } finally {
      setSaving(false);
    }
  };
  const discard = () =>
    loaded && setProjectEditState(projectDispatch, asDto(loaded));
  const reload = async () => {
    setConflict(null);
    const projects = await getProjectList(projectDispatch);
    const fresh = projects.find((project) => project.id === projectId);
    if (fresh) {
      setLoaded(fresh);
      setProjectEditState(projectDispatch, asDto(fresh));
    }
  };

  // ---- delete (REQ-018-49)
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [typedName, setTypedName] = React.useState("");
  const remove = () => {
    // nothing left to save once it is gone: the leave guard must not stop us
    discard();
    return deleteProject(projectDispatch, projectId)
      .then((project) => {
        enqueueSnackbar(t("projectList.deletedToast", { name: project.name }), {
          variant: "success",
        });
        setLoaded(undefined);
        navigate(routes.PROJECT_LIST_PAGE);
      })
      .catch((error) => enqueueSnackbar(String(error), { variant: "error" }));
  };

  if (!saved && projectList.length) {
    return (
      <EmptyState title={t("settings.noSuchProject")}>
        {t("settings.maybeDeleted")}
      </EmptyState>
    );
  }
  if (!ready) {
    return (
      <Box sx={{ p: 6, display: "grid", placeItems: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  const section = (id: SectionId, content: React.ReactNode) => {
    const meta = SETTINGS_SECTIONS.find((s) => s.id === id);
    const index = SETTINGS_SECTIONS.findIndex((s) => s.id === id);
    return (
      <Box
        component="section"
        key={id}
        data-section={id}
        data-testid={`section-${id}`}
        aria-labelledby={`section-${id}-title`}
        hidden={!match.sections.includes(id)}
        // `hidden` alone loses to the display below
        style={
          {
            "--v-delay": `${index * motion.stagger}ms`,
            display: match.sections.includes(id) ? undefined : "none",
          } as React.CSSProperties
        }
        className="v-enter"
        sx={{
          scrollMarginTop: 16,
          bgcolor: tokens.surface,
          border: `1px solid ${id === "danger" ? tokens.status.failed.bar : tokens.border}`,
          borderRadius: 3.5,
          px: 2.5,
          pt: 2,
          pb: 2.5,
          display: "flex",
          flexDirection: "column",
          gap: 1.5,
        }}
      >
        <Box>
          <Typography id={`section-${id}-title`} variant="h6" component="h2">
            {meta && t(meta.title)}
          </Typography>
          {DESCRIPTION[id] && (
            <Typography
              variant="body2"
              color="textSecondary"
              sx={{ maxWidth: "70ch" }}
            >
              {t(DESCRIPTION[id] as MessageKey)}
            </Typography>
          )}
        </Box>
        {content}
      </Box>
    );
  };

  return (
    <ValidatorForm onSubmit={() => save()} instantValidate>
      <Box sx={{ px: 4, pt: 3, pb: 2 }}>
        <Box
          className="v-enter"
          sx={{ display: "flex", flexDirection: "column", gap: 0.5, mb: 2.5 }}
        >
          <Button
            startIcon={<ArrowBack />}
            size="small"
            onClick={() => navigate(routes.PROJECT_LIST_PAGE)}
            sx={{ alignSelf: "flex-start", color: tokens.textSecondary, px: 1 }}
          >
            {t("settings.backToProjects")}
          </Button>
          <Box
            sx={{
              display: "flex",
              alignItems: "baseline",
              gap: 1.5,
              flexWrap: "wrap",
            }}
          >
            <Typography variant="h4" component="h1">
              {t("settings.title")}
            </Typography>
            <Typography color="textSecondary">{loaded.name}</Typography>
          </Box>
        </Box>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "220px minmax(0, 1fr)" },
            gap: 3.5,
            alignItems: "start",
          }}
        >
          <Box
            component="nav"
            aria-label={t("settings.sections")}
            sx={{
              position: { md: "sticky" },
              top: 16,
              display: "flex",
              flexDirection: "column",
              gap: 1.25,
            }}
          >
            <TextField
              size="small"
              placeholder={t("settings.findPlaceholder")}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              inputProps={{
                "aria-label": t("settings.find"),
                "data-testid": "settingsSearch",
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
            <Box
              sx={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
                gap: 0.25,
              }}
            >
              <Box
                aria-hidden="true"
                sx={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: 0,
                  height: 36,
                  borderRadius: 2,
                  bgcolor: tokens.brandSoft,
                  transform: `translateY(${navButtons.current[active]?.offsetTop ?? 0}px)`,
                  transition: `transform ${motion.nav}ms ${motion.easing}`,
                }}
              />
              {SETTINGS_SECTIONS.map(({ id, title }) => {
                const found = match.sections.includes(id);
                const isChanged = changed.includes(t(title));
                return (
                  <ButtonBase
                    key={id}
                    ref={(el) => {
                      navButtons.current[id] = el;
                    }}
                    onClick={() => goTo(id)}
                    aria-current={active === id ? "true" : undefined}
                    data-testid={`nav-${id}`}
                    sx={{
                      position: "relative",
                      height: 36,
                      px: 1.25,
                      borderRadius: 2,
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 1,
                      textAlign: "left",
                      whiteSpace: "nowrap",
                      fontWeight: 500,
                      fontSize: 14,
                      color:
                        active === id ? tokens.brand : tokens.textSecondary,
                      opacity: found ? 1 : 0.35,
                      transition: `color ${motion.base}ms, opacity ${motion.base}ms`,
                    }}
                  >
                    <span>
                      {t(title)}
                      {isChanged && (
                        <Box
                          component="span"
                          aria-label={t("settings.unsavedMark")}
                          sx={{
                            display: "inline-block",
                            width: 6,
                            height: 6,
                            ml: 0.75,
                            mb: "2px",
                            borderRadius: "50%",
                            bgcolor: tokens.status.changed.bar,
                          }}
                        />
                      )}
                    </span>
                    <Typography
                      component="span"
                      variant="caption"
                      noWrap
                      sx={{
                        fontFamily: tokens.mono,
                        color: tokens.textMuted,
                        flexShrink: 0,
                      }}
                    >
                      {sectionMeta(id, edited, t)}
                    </Typography>
                  </ButtonBase>
                );
              })}
            </Box>
          </Box>

          <Box
            ref={sectionsRef}
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 2.25,
              maxWidth: 820,
              minWidth: 0,
              "& .v-hit": {
                bgcolor: tokens.brandSoft,
                boxShadow: `0 0 0 3px ${tokens.brandSoft}`,
                borderRadius: "4px",
              },
            }}
          >
            {match.sections.length === 0 && (
              <EmptyState title={t("settings.nothingMatches", { query })}>
                {t("settings.nothingMatchesHint")}
              </EmptyState>
            )}
            {section("general", <GeneralFields />)}
            {section("review", <ReviewFields />)}
            {section("comparison", <ComparisonFields />)}
            {section("mobile", <MobileSettings bare />)}
            {section("a11y", <A11yRulesSettings bare />)}
            {section("jira", <JiraSettings bare />)}
            {section(
              "danger",
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  flexWrap: "wrap",
                }}
              >
                <Typography variant="body2" sx={{ flex: 1, minWidth: 240 }}>
                  {tx("settings.dangerText", {
                    title: <b>{t("settings.dangerTitle")}</b>,
                  })}
                </Typography>
                <Button
                  variant="outlined"
                  color="error"
                  onClick={() => setDeleteOpen(true)}
                  data-testid="deleteProject"
                >
                  {t("settings.deleteProject")}
                </Button>
              </Box>,
            )}

            {/* the save bar comes up with the first change (REQ-018-47) */}
            <Box
              role="status"
              data-testid="saveBar"
              data-state={justSaved ? "saved" : dirty ? "dirty" : "clean"}
              sx={{
                position: "sticky",
                bottom: 16,
                zIndex: 3,
                display: "flex",
                alignItems: "center",
                gap: 1.25,
                pl: 2,
                pr: 1.25,
                py: 1,
                // a floating card like the Areas menu: a black bar was the one
                // dark slab on the light page
                borderRadius: "14px",
                border: `1px solid ${justSaved ? tokens.brand : tokens.border}`,
                bgcolor: justSaved ? tokens.brandSoft : tokens.surface,
                color: justSaved ? tokens.brandDark : tokens.text,
                boxShadow: tokens.shadowPop,
                transform:
                  dirty || justSaved ? "none" : "translateY(calc(100% + 32px))",
                opacity: dirty || justSaved ? 1 : 0,
                pointerEvents: dirty ? "auto" : "none",
                transition: `transform 380ms ${motion.easing}, opacity 240ms, background-color ${motion.base}ms, border-color ${motion.base}ms`,
              }}
            >
              <Typography
                variant="body2"
                sx={{ flex: 1, display: "flex", alignItems: "center", gap: 1 }}
              >
                {justSaved ? (
                  <>
                    <Check fontSize="small" /> {t("settings.saved")}
                  </>
                ) : (
                  <>
                    {/* the same mark as the changed sections in the rail */}
                    <Box
                      component="span"
                      aria-hidden="true"
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        flexShrink: 0,
                        bgcolor: tokens.status.changed.bar,
                      }}
                    />
                    <span>
                      {tx("settings.unsavedIn", {
                        sections: <b>{changed.join(", ")}</b>,
                      })}
                    </span>
                  </>
                )}
              </Typography>
              <Button
                size="small"
                onClick={discard}
                disabled={saving || justSaved}
                data-testid="discardSettings"
                sx={{ color: tokens.textSecondary }}
              >
                {t("settings.discard")}
              </Button>
              <Button
                size="small"
                variant="contained"
                type="submit"
                disabled={saving || justSaved}
                data-testid="saveSettings"
              >
                {saving ? (
                  <CircularProgress size={16} color="inherit" />
                ) : (
                  t("settings.save")
                )}
              </Button>
            </Box>
          </Box>
        </Box>
      </Box>

      <Dialog
        open={!!conflict}
        onClose={() => setConflict(null)}
        data-testid="settingsConflict"
      >
        <DialogTitle>{t("settings.conflictTitle")}</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            {t("settings.conflictChanged", {
              sections: conflict?.join(", ") ?? "",
            })}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            {t("settings.conflictHint")}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={reload}>{t("settings.reload")}</Button>
          <Button
            variant="contained"
            onClick={() => save(true)}
            data-testid="saveOver"
          >
            {t("settings.saveOver")}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={blocker.state === "blocked"}
        onClose={() => blocker.reset?.()}
        data-testid="leaveSettings"
      >
        <DialogTitle>{t("settings.leaveTitle")}</DialogTitle>
        <DialogContent>
          <Typography>
            {t("settings.leaveText", { sections: changed.join(", ") })}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => blocker.reset?.()}>
            {t("settings.stay")}
          </Button>
          <Button
            color="error"
            onClick={() => blocker.proceed?.()}
            data-testid="leaveAnyway"
          >
            {t("settings.leave")}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        data-testid="deleteProjectDialog"
      >
        <DialogTitle>
          {t("deleteProject.title", { name: loaded.name })}
        </DialogTitle>
        <DialogContent
          sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}
        >
          <Typography>
            {tx("deleteProject.confirm", { name: <b>{loaded.name}</b> })}
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
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={!deleteConfirmed(loaded.name, typedName)}
            onClick={remove}
            data-testid="deleteForever"
          >
            {t("deleteProject.submit")}
          </Button>
        </DialogActions>
      </Dialog>
    </ValidatorForm>
  );
};

export default ProjectSettingsPage;
