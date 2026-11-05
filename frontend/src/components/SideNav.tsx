import React from "react";
import {
  Avatar,
  Box,
  Divider,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  BackupOutlined,
  FlagOutlined,
  FolderOutlined,
  GridViewOutlined,
  HelpOutline,
  InsightsOutlined,
  PeopleOutline,
  PhoneAndroid,
  UnfoldMore,
  ViewAgendaOutlined,
} from "@mui/icons-material";
import {
  selectProject,
  useProjectDispatch,
  useProjectState,
  useThemeMode,
  useUserState,
} from "../contexts";
import { LOCATOR_SIDE_NAV_PROJECT, routes } from "../constants";
import { BRAND } from "../constants/brand";
import { useT } from "../i18n";
import {
  activeSideNavItem,
  projectSectionPath,
  SideNavItem,
  SideNavKey,
  sideNavItems,
} from "../_helpers/sideNav.helper";
import { BrandLockup, BrandMark } from "./BrandMark";
import ProjectSelect from "./ProjectSelect";
import GuidedTour from "./GuidedTour";
import { ManualChecksDialog } from "./ManualChecksDialog";
import { AccountMenu, accountItemSx } from "./AccountMenu";
import {
  ACCOUNT_BUTTON_TEST_ID,
  HELP_MENU_BUTTON_TEST_ID,
  HELP_MENU_ID,
  SIDE_NAV_TEST_ID,
  VERSION_TEST_ID,
} from "./SideNav.locators";
import { motion, radius, tokens, type } from "../theme";

/** Below this window width the sidebar keeps its icons only (REQ-046-25). */
export const SIDE_NAV_FOLD_QUERY = "(max-width: 1099.98px)";
const WIDE = 232;
const FOLDED = 64;

const ICONS: Record<SideNavKey, React.ReactNode> = {
  projects: <FolderOutlined />,
  users: <PeopleOutline />,
  backups: <BackupOutlined />,
  builds: <ViewAgendaOutlined />,
  baselines: <GridViewOutlined />,
  insights: <InsightsOutlined />,
};

const rowSx = (folded: boolean) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: folded ? "center" : "flex-start",
  gap: 1.25,
  height: folded ? 40 : 36,
  width: folded ? 40 : "auto",
  px: folded ? 0 : 1.25,
  borderRadius: radius.control,
  fontSize: type.body,
  fontWeight: 500,
  textDecoration: "none",
  whiteSpace: "nowrap",
  "& .MuiSvgIcon-root": { width: 18, height: 18, flexShrink: 0 },
});

const ellipsis = {
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
} as const;

const initials = (first?: string, last?: string, email?: string) =>
  `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase() ||
  (email?.[0] ?? "?").toUpperCase();

/**
 * The labelled sidebar after sign-in (spec 046, ADR-0028): the logo, Projects,
 * Users and Backups for admins, the project switcher with the project's own
 * pages, Help with the version, and the account.
 */
const SideNav: React.FunctionComponent = () => {
  const folded = useMediaQuery(SIDE_NAV_FOLD_QUERY, { noSsr: true });
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user } = useUserState();
  const { projectList, selectedProjectId } = useProjectState();
  const projectDispatch = useProjectDispatch();
  const { preference } = useThemeMode();
  const { t, language } = useT();
  const [helpAnchor, setHelpAnchor] = React.useState<HTMLElement | null>(null);
  const [accountAnchor, setAccountAnchor] = React.useState<HTMLElement | null>(
    null,
  );
  const [manualChecksOpen, setManualChecksOpen] = React.useState(false);
  const version = window._env_?.VISION_VERSION;

  const items = sideNavItems(user?.role, selectedProjectId, projectList.length);
  const active = activeSideNavItem(pathname);

  // the highlight travels to the new item instead of jumping (REQ-018-22)
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
              ...rowSx(folded),
              position: "relative",
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
              ...rowSx(folded),
              // above the travelling highlight
              position: "relative",
              color: on ? tokens.brandDark : tokens.textSecondary,
              fontWeight: on ? 600 : 500,
              transition: `color ${motion.nav}ms ${motion.easing}, background-color ${motion.fast}ms`,
              "& .MuiSvgIcon-root": {
                width: 18,
                height: 18,
                flexShrink: 0,
                color: on ? tokens.brand : tokens.textMuted,
              },
              "&:hover": { bgcolor: on ? "transparent" : tokens.subtle },
              "[data-theme='dark'] &": on ? { color: tokens.brand } : {},
            }}
          >
            {content}
          </Box>
        )}
      </Tooltip>
    );
  };

  const themeName = t(
    preference === "dark"
      ? "account.themeDark"
      : preference === "light"
        ? "account.themeLight"
        : "account.themeSystem",
  );
  const name =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email;
  const helpLabel = t("nav.help");

  return (
    <Box
      component="nav"
      aria-label={t("nav.main")}
      data-testid={SIDE_NAV_TEST_ID}
      data-folded={folded ? "true" : "false"}
      sx={{
        width: folded ? FOLDED : WIDE,
        flexShrink: 0,
        height: "100%",
        boxSizing: "border-box",
        overflowY: "auto",
        overflowX: "hidden",
        bgcolor: tokens.surface,
        borderRight: `1px solid ${tokens.border}`,
        display: "flex",
        flexDirection: "column",
        alignItems: folded ? "center" : "stretch",
        gap: 0.5,
        py: 2,
        px: 1.5,
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
          bgcolor: tokens.brandSoft,
          opacity: indicator === null ? 0 : 1,
          transform: `translate(${indicator?.left ?? 0}px, ${indicator?.top ?? 0}px)`,
          transition: `transform ${motion.nav}ms ${motion.easing}, opacity ${motion.fast}ms`,
          "[data-theme='dark'] &": {
            boxShadow: "0 0 18px -2px rgba(67, 196, 106, 0.35)",
          },
        }}
      />
      <Box
        component={Link}
        to={routes.HOME}
        aria-label={t("header.home", { brand: BRAND.name })}
        sx={{
          display: "flex",
          alignItems: "center",
          height: 40,
          px: folded ? 0 : 1,
          mb: 1.5,
          color: "inherit",
          textDecoration: "none",
          position: "relative",
        }}
      >
        {folded ? (
          <BrandMark size={28} />
        ) : (
          <BrandLockup markSize={28} wordSize={18} />
        )}
      </Box>

      {items.filter((item) => item.group === "main").map(renderItem)}

      <Box
        id={LOCATOR_SIDE_NAV_PROJECT}
        sx={{
          mt: 2,
          mb: 0.5,
          width: folded ? 40 : "auto",
          position: "relative",
        }}
      >
        <ProjectSelect
          sidebar
          folded={folded}
          onProjectSelect={(id) => {
            selectProject(projectDispatch, id);
            navigate(projectSectionPath(pathname, id));
          }}
        />
      </Box>

      {items.filter((item) => item.group === "project").map(renderItem)}

      <Box sx={{ flex: 1, minHeight: 16 }} />

      <Tooltip
        title={folded ? `${helpLabel} · ${BRAND.name} ${version ?? ""}` : ""}
        placement="right"
      >
        <Box
          component="button"
          type="button"
          onClick={(event: React.MouseEvent<HTMLElement>) =>
            setHelpAnchor(event.currentTarget)
          }
          aria-haspopup="menu"
          aria-label={helpLabel}
          data-testid={HELP_MENU_BUTTON_TEST_ID}
          sx={{
            ...rowSx(folded),
            position: "relative",
            border: 0,
            bgcolor: "transparent",
            fontFamily: "inherit",
            fontSize: type.body,
            fontWeight: 500,
            color: tokens.textSecondary,
            cursor: "pointer",
            textAlign: "left",
            "& .MuiSvgIcon-root": {
              width: 18,
              height: 18,
              color: tokens.textMuted,
            },
            "&:hover": { bgcolor: tokens.subtle },
          }}
        >
          <HelpOutline />
          {!folded && (
            <>
              <Box component="span" sx={{ ...ellipsis, flex: 1 }}>
                {helpLabel}
              </Box>
              <Box
                component="span"
                data-testid={VERSION_TEST_ID}
                sx={{
                  fontSize: type.caption,
                  color: tokens.textMuted,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                v{version}
              </Box>
            </>
          )}
        </Box>
      </Tooltip>

      <Tooltip title={folded ? (name ?? "") : ""} placement="right">
        <Box
          component="button"
          type="button"
          onClick={(event: React.MouseEvent<HTMLElement>) =>
            setAccountAnchor(event.currentTarget)
          }
          aria-haspopup="menu"
          aria-label={t("account.menu")}
          data-testid={ACCOUNT_BUTTON_TEST_ID}
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: folded ? "center" : "flex-start",
            gap: 1.25,
            height: folded ? 40 : 52,
            width: folded ? 40 : "auto",
            px: folded ? 0 : 1,
            mt: 0.5,
            position: "relative",
            border: 0,
            borderRadius: radius.control,
            fontFamily: "inherit",
            cursor: "pointer",
            textAlign: "left",
            bgcolor: pathname.startsWith(routes.PROFILE_PAGE)
              ? tokens.brandSoft
              : "transparent",
            "&:hover": { bgcolor: tokens.subtle },
          }}
        >
          <Avatar
            sx={{
              width: 28,
              height: 28,
              fontSize: type.caption,
              fontWeight: 700,
              bgcolor: tokens.brandSoft,
              color: tokens.brandDark,
              "[data-theme='dark'] &": { color: tokens.brand },
            }}
          >
            {initials(user?.firstName, user?.lastName, user?.email)}
          </Avatar>
          {!folded && (
            <>
              <Box
                component="span"
                sx={{
                  flex: 1,
                  minWidth: 0,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <Box
                  component="span"
                  sx={{
                    ...ellipsis,
                    whiteSpace: "nowrap",
                    fontSize: type.body,
                    fontWeight: 600,
                    color: tokens.text,
                  }}
                >
                  {name}
                </Box>
                <Box
                  component="span"
                  sx={{
                    ...ellipsis,
                    whiteSpace: "nowrap",
                    fontSize: type.caption,
                    color: tokens.textMuted,
                  }}
                >
                  {language.toUpperCase()} · {themeName}
                </Box>
              </Box>
              <UnfoldMore
                sx={{ width: 16, height: 16, color: tokens.textMuted }}
              />
            </>
          )}
        </Box>
      </Tooltip>

      <Menu
        id={HELP_MENU_ID}
        data-testid={HELP_MENU_ID}
        anchorEl={helpAnchor}
        open={!!helpAnchor}
        onClose={() => setHelpAnchor(null)}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
        transformOrigin={{ vertical: "bottom", horizontal: "left" }}
        keepMounted
        slotProps={{ paper: { sx: { minWidth: 240, p: 0.75, ml: 1 } } }}
      >
        <MenuItem
          onClick={() => setHelpAnchor(null)}
          sx={{ ...accountItemSx, p: 0 }}
        >
          <GuidedTour />
        </MenuItem>
        <MenuItem
          onClick={() => {
            setHelpAnchor(null);
            setManualChecksOpen(true);
          }}
          sx={accountItemSx}
        >
          <PhoneAndroid />
          {t("header.manualChecks")}
        </MenuItem>
        {BRAND.supportUrl && (
          <MenuItem
            onClick={() => {
              setHelpAnchor(null);
              window.open(BRAND.supportUrl, "_blank", "noopener");
            }}
            sx={accountItemSx}
          >
            <FlagOutlined />
            {t("header.reportProblem")}
          </MenuItem>
        )}
        <Divider sx={{ my: 0.75 }} />
        <Typography
          component="div"
          variant="caption"
          sx={{ px: 1.25, py: 0.5, color: tokens.textMuted }}
        >
          {BRAND.name} {version}
        </Typography>
      </Menu>
      <AccountMenu
        anchorEl={accountAnchor}
        onClose={() => setAccountAnchor(null)}
      />
      <ManualChecksDialog
        open={manualChecksOpen}
        onClose={() => setManualChecksOpen(false)}
      />
    </Box>
  );
};

export default SideNav;
