import React from "react";
import { Box, Tooltip, useMediaQuery } from "@mui/material";
import { Link, useLocation } from "react-router-dom";
import {
  BackupOutlined,
  GridViewOutlined,
  InsightsOutlined,
  PeopleOutline,
  ViewAgendaOutlined,
} from "@mui/icons-material";
import {
  selectProject,
  useProjectDispatch,
  useProjectState,
  useUserState,
} from "../contexts";
import { useT } from "../i18n";
import {
  activeSideNavItem,
  projectHeadingState,
  projectSectionPath,
  SideNavItem,
  SideNavKey,
  sideNavItems,
} from "../_helpers/sideNav.helper";
import { ProjectRail, RAIL_WIDTH } from "./ProjectRail";
import { PANEL_WIDTH, SectionPanel } from "./SectionPanel";
import { AccountMenu } from "./AccountMenu";
import { SIDE_NAV_TEST_ID } from "./SideNav.locators";
import { motion, radius, tokens, type } from "../theme";

/** Below this window width only the rail stays, with the sections as icons (REQ-057-30). */
export const SIDE_NAV_FOLD_QUERY = "(max-width: 1099.98px)";

const ICONS: Record<SideNavKey, React.ReactNode> = {
  builds: <ViewAgendaOutlined />,
  baselines: <GridViewOutlined />,
  insights: <InsightsOutlined />,
  users: <PeopleOutline />,
  backups: <BackupOutlined />,
};

const ellipsis = {
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
} as const;

/**
 * The sidebar after sign-in (spec 057, ADR-0028): a rail of projects with the
 * account, and next to it the chosen project's sections and, for admins,
 * Administration. Below 1100 px the panel folds into icons in the rail.
 */
const SideNav: React.FunctionComponent = () => {
  const folded = useMediaQuery(SIDE_NAV_FOLD_QUERY, { noSsr: true });
  const { pathname } = useLocation();
  const { user } = useUserState();
  const { projectList, selectedProjectId } = useProjectState();
  const projectDispatch = useProjectDispatch();
  const { t } = useT();
  const [accountAnchor, setAccountAnchor] = React.useState<HTMLElement | null>(
    null,
  );

  const items = sideNavItems(user?.role, selectedProjectId, projectList.length);
  const active = activeSideNavItem(pathname);
  const heading = projectHeadingState(projectList, selectedProjectId);

  // the highlight travels to the new item instead of jumping (REQ-018-22, REQ-057-40)
  const nodes = React.useRef<Partial<Record<SideNavKey, HTMLElement | null>>>(
    {},
  );
  const [indicator, setIndicator] = React.useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);
  const itemKeys = items.map((item) => item.key).join();
  React.useLayoutEffect(() => {
    const node = active ? nodes.current[active] : null;
    setIndicator(
      node
        ? {
            top: node.offsetTop,
            left: node.offsetLeft,
            width: node.offsetWidth,
            height: node.offsetHeight,
          }
        : null,
    );
  }, [active, itemKeys, folded, selectedProjectId, projectList.length]);

  const renderItem = (item: SideNavItem) => {
    const label = t(item.label);
    const on = item.key === active && !item.disabled;
    const small = item.group === "admin";
    const sx = {
      position: "relative",
      display: "flex",
      alignItems: "center",
      justifyContent: folded ? "center" : "flex-start",
      gap: 1.5,
      height: folded ? 40 : small ? 34 : 38,
      width: folded ? 44 : "auto",
      px: folded ? 0 : 1.25,
      borderRadius: radius.control,
      fontSize: small ? type.small : type.body,
      fontWeight: on ? 600 : 500,
      textDecoration: "none",
      color: on ? tokens.text : tokens.textSecondary,
      transition: `color ${motion.nav}ms ${motion.easing}, background-color ${motion.fast}ms`,
      "& .MuiSvgIcon-root": {
        width: small ? 18 : 20,
        height: small ? 18 : 20,
        flexShrink: 0,
        color: on ? tokens.brand : tokens.textMuted,
      },
    } as const;
    const content = (
      <>
        {ICONS[item.key]}
        {!folded && (
          <Box component="span" sx={ellipsis}>
            {label}
          </Box>
        )}
      </>
    );
    const ref = (element: HTMLElement | null) => {
      nodes.current[item.key] = element;
    };
    const tip = folded
      ? item.disabled
        ? `${label} · ${t("nav.pickProjectFirst")}`
        : label
      : item.disabled
        ? t("nav.pickProjectFirst")
        : "";
    return (
      <Tooltip key={item.key} title={tip} placement="right">
        {item.disabled || !item.to ? (
          <Box
            component="span"
            ref={ref}
            role="link"
            aria-disabled="true"
            aria-label={label}
            data-testid={`nav-${item.key}`}
            sx={{
              ...sx,
              color: tokens.textMuted,
              opacity: 0.6,
              cursor: "default",
            }}
          >
            {content}
          </Box>
        ) : (
          <Box
            component={Link}
            to={item.to}
            ref={ref}
            aria-label={label}
            aria-current={on ? "page" : undefined}
            data-testid={`nav-${item.key}`}
            sx={{
              ...sx,
              "&:hover": {
                bgcolor: on ? "transparent" : tokens.subtle,
                color: tokens.text,
              },
            }}
          >
            {content}
          </Box>
        )}
      </Tooltip>
    );
  };

  const sections = items
    .filter((item) => item.group === "project")
    .map(renderItem);
  const adminItems = items.filter((item) => item.group === "admin");
  const admin = adminItems.length ? adminItems.map(renderItem) : undefined;
  const name =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.email ||
    "";

  return (
    <Box
      component="nav"
      aria-label={t("nav.main")}
      data-testid={SIDE_NAV_TEST_ID}
      data-folded={folded ? "true" : "false"}
      sx={{
        width: folded ? RAIL_WIDTH : RAIL_WIDTH + PANEL_WIDTH,
        flexShrink: 0,
        height: "100%",
        boxSizing: "border-box",
        overflow: "hidden",
        display: "flex",
        bgcolor: tokens.surface,
        borderRight: `1px solid ${tokens.border}`,
        position: "relative",
        transition: `width ${motion.base}ms ${motion.easing}`,
      }}
    >
      <Box
        aria-hidden="true"
        data-testid="navIndicator"
        sx={{
          position: "absolute",
          left: 0,
          top: 0,
          width: indicator?.width ?? 0,
          height: indicator?.height ?? 0,
          borderRadius: radius.control,
          bgcolor: tokens.subtle,
          opacity: indicator === null ? 0 : 1,
          transform: `translate(${indicator?.left ?? 0}px, ${indicator?.top ?? 0}px)`,
          transition: `transform ${motion.nav}ms ${motion.easing}, opacity ${motion.fast}ms`,
        }}
      />
      <ProjectRail
        projects={projectList}
        selectedProjectId={selectedProjectId}
        role={user?.role}
        tileTo={(id) => projectSectionPath(pathname, id)}
        onTile={(id) => selectProject(projectDispatch, id)}
        user={user}
        accountLabel={name}
        onAccount={setAccountAnchor}
        sections={folded ? sections : undefined}
        admin={
          folded && admin ? (
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 0.25,
              }}
            >
              {admin}
            </Box>
          ) : undefined
        }
      />
      {!folded && (
        <SectionPanel heading={heading} sections={sections} admin={admin} />
      )}
      <AccountMenu
        anchorEl={accountAnchor}
        onClose={() => setAccountAnchor(null)}
      />
    </Box>
  );
};

export default SideNav;
