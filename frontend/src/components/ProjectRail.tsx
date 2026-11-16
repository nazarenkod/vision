import React from "react";
import { Avatar, Box, Tooltip } from "@mui/material";
import { Link } from "react-router-dom";
import { Add } from "@mui/icons-material";
import { LOCATOR_SIDE_NAV_PROJECT, routes } from "../constants";
import { BRAND } from "../constants/brand";
import { useT } from "../i18n";
import type { User } from "../types";
import { projectTileLabel } from "../_helpers/sideNav.helper";
import { BrandMark } from "./BrandMark";
import {
  ACCOUNT_BUTTON_TEST_ID,
  NEW_PROJECT_TILE_TEST_ID,
  PROJECT_RAIL_TEST_ID,
  projectTileTestId,
} from "./SideNav.locators";
import { motion, radius, tokens, type } from "../theme";

// the roles the API lets create projects
const PROJECT_CREATOR_ROLES = new Set<User["role"]>(["admin", "editor"]);
export const RAIL_WIDTH = 64;
const TILE = 42;

const tileSx = {
  width: TILE,
  height: TILE,
  flexShrink: 0,
  display: "grid",
  placeItems: "center",
  borderRadius: radius.card,
  fontSize: type.small,
  fontWeight: 700,
  lineHeight: 1,
  textDecoration: "none",
  transition: `background-color ${motion.fast}ms, box-shadow ${motion.fast}ms`,
} as const;

const initials = (first?: string, last?: string, email?: string) =>
  `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase() ||
  (email?.[0] ?? "?").toUpperCase();

/**
 * The rail of the sidebar (spec 060): the logo to Projects, a tile per project the
 * user can see, a plus tile for those who may create one, and the account. Below
 * 1100 px the panel's sections come into the rail as `sections`.
 */
export const ProjectRail: React.FunctionComponent<{
  projects: Array<{ id: string; name: string }>;
  selectedProjectId: string | null | undefined;
  role: User["role"] | undefined;
  tileTo: (projectId: string) => string;
  onTile: (projectId: string) => void;
  user: { firstName?: string; lastName?: string; email?: string } | undefined;
  accountLabel: string;
  onAccount: (anchor: HTMLElement) => void;
  /** the sections, folded into icons below the tiles */
  sections?: React.ReactNode;
  /** the administration, folded into icons above the account */
  admin?: React.ReactNode;
}> = ({
  projects,
  selectedProjectId,
  role,
  tileTo,
  onTile,
  user,
  accountLabel,
  onAccount,
  sections,
  admin,
}) => {
  const { t } = useT();
  const tilesRef = React.useRef<HTMLDivElement | null>(null);
  const canCreate = !!role && PROJECT_CREATOR_ROLES.has(role);

  // the chosen project stays in sight when the tiles scroll (REQ-060-06)
  React.useLayoutEffect(() => {
    const box = tilesRef.current;
    const tile = box?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!box || !tile) return;
    const top =
      tile.getBoundingClientRect().top - box.getBoundingClientRect().top;
    if (top < 0 || top + tile.offsetHeight > box.clientHeight) {
      box.scrollTop += top - (box.clientHeight - tile.offsetHeight) / 2;
    }
  }, [selectedProjectId, projects.length]);

  return (
    <Box
      data-testid={PROJECT_RAIL_TEST_ID}
      sx={{
        width: RAIL_WIDTH,
        flexShrink: 0,
        height: "100%",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 0.5,
        py: 2,
        bgcolor: tokens.ground,
        borderRight: `1px solid ${tokens.border}`,
      }}
    >
      <Tooltip title={t("nav.projects")} placement="right">
        <Box
          component={Link}
          to={routes.PROJECT_LIST_PAGE}
          aria-label={t("header.home", { brand: BRAND.name })}
          data-testid="railLogo"
          sx={{ display: "grid", placeItems: "center", height: 40, mb: 1 }}
        >
          <BrandMark size={30} />
        </Box>
      </Tooltip>
      <Box
        aria-hidden="true"
        sx={{ width: 28, height: "1px", bgcolor: tokens.border, mb: 1 }}
      />

      <Box
        ref={tilesRef}
        id={LOCATOR_SIDE_NAV_PROJECT}
        role="list"
        aria-label={t("nav.projects")}
        sx={{
          flex: "0 1 auto",
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
          // room for the chosen tile's ring
          p: "4px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 1.25,
          scrollbarWidth: "none",
          "&::-webkit-scrollbar": { display: "none" },
        }}
      >
        {projects.map((project) => {
          const chosen = project.id === selectedProjectId;
          return (
            <Box role="listitem" key={project.id}>
              <Tooltip title={project.name} placement="right">
                <Box
                  component={Link}
                  to={tileTo(project.id)}
                  onClick={() => onTile(project.id)}
                  aria-label={project.name}
                  aria-current={chosen ? "true" : undefined}
                  data-testid={projectTileTestId(project.id)}
                  sx={{
                    ...tileSx,
                    bgcolor: chosen ? tokens.text : tokens.subtle,
                    color: chosen ? tokens.surface : tokens.textSecondary,
                    boxShadow: chosen
                      ? `0 0 0 2px ${tokens.ground}, 0 0 0 4px ${tokens.brand}`
                      : "none",
                    "&:hover": chosen ? {} : { bgcolor: tokens.border },
                  }}
                >
                  {projectTileLabel(project.name)}
                </Box>
              </Tooltip>
            </Box>
          );
        })}
        {canCreate && (
          <Box role="listitem">
            <Tooltip title={t("projectSelect.newProject")} placement="right">
              <Box
                component={Link}
                to={`${routes.PROJECT_LIST_PAGE}?create=1`}
                aria-label={t("projectSelect.newProject")}
                data-testid={NEW_PROJECT_TILE_TEST_ID}
                sx={{
                  ...tileSx,
                  border: `1px dashed ${tokens.borderStrong}`,
                  boxSizing: "border-box",
                  color: tokens.textMuted,
                  "&:hover": { bgcolor: tokens.subtle, color: tokens.text },
                  "& .MuiSvgIcon-root": { width: 18, height: 18 },
                }}
              >
                <Add />
              </Box>
            </Tooltip>
          </Box>
        )}
      </Box>

      {sections && (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 0.5,
            mt: 2,
            pt: 2,
            borderTop: `1px solid ${tokens.border}`,
          }}
        >
          {sections}
        </Box>
      )}

      <Box sx={{ flex: 1, minHeight: 16 }} />
      {admin}

      <Tooltip title={accountLabel} placement="right">
        <Box
          component="button"
          type="button"
          onClick={(event: React.MouseEvent<HTMLElement>) =>
            onAccount(event.currentTarget)
          }
          aria-haspopup="menu"
          aria-label={t("account.menu")}
          data-testid={ACCOUNT_BUTTON_TEST_ID}
          sx={{
            mt: 1,
            p: 0,
            border: 0,
            borderRadius: radius.pill,
            bgcolor: "transparent",
            cursor: "pointer",
            "&:focus-visible": { outline: `2px solid ${tokens.brand}` },
          }}
        >
          <Avatar
            sx={{
              width: 36,
              height: 36,
              fontSize: type.caption,
              fontWeight: 700,
              bgcolor: tokens.subtle,
              color: tokens.text,
              border: `1px solid ${tokens.border}`,
            }}
          >
            {initials(user?.firstName, user?.lastName, user?.email)}
          </Avatar>
        </Box>
      </Tooltip>
    </Box>
  );
};
