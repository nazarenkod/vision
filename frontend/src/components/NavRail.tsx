import React from "react";
import { Box, IconButton, Tooltip } from "@mui/material";
import { Link, useLocation } from "react-router-dom";
import {
  FolderOutlined,
  ViewAgendaOutlined,
  GridViewOutlined,
  PeopleOutline,
  PersonOutline,
} from "@mui/icons-material";
import { useProjectState, useUserState } from "../contexts";
import { routes } from "../constants";
import { tokens } from "../theme";

interface RailItem {
  label: string;
  to: string;
  icon: React.ReactNode;
  active: (path: string) => boolean;
}

/** Narrow left navigation, the same pattern as the company's other tools. */
const NavRail: React.FunctionComponent = () => {
  const { pathname } = useLocation();
  const { selectedProjectId } = useProjectState();
  const { user } = useUserState();

  const items: RailItem[] = [
    {
      label: "Projects",
      to: routes.PROJECT_LIST_PAGE,
      icon: <FolderOutlined />,
      active: (path) => path.startsWith(routes.PROJECT_LIST_PAGE),
    },
    ...(selectedProjectId
      ? [
          {
            label: "Builds",
            to: `${routes.HOME}${selectedProjectId}`,
            icon: <ViewAgendaOutlined />,
            active: (path: string) =>
              path === `${routes.HOME}${selectedProjectId}`,
          },
          {
            label: "Baselines",
            to: `${routes.VARIATION_LIST_PAGE}/${selectedProjectId}`,
            icon: <GridViewOutlined />,
            active: (path: string) =>
              path.startsWith(routes.VARIATION_LIST_PAGE),
          },
        ]
      : []),
    ...(user?.role === "admin"
      ? [
          {
            label: "Users",
            to: routes.USER_LIST_PAGE,
            icon: <PeopleOutline />,
            active: (path: string) => path.startsWith(routes.USER_LIST_PAGE),
          },
        ]
      : []),
    {
      label: "Profile",
      to: routes.PROFILE_PAGE,
      icon: <PersonOutline />,
      active: (path) => path.startsWith(routes.PROFILE_PAGE),
    },
  ];

  return (
    <Box
      component="nav"
      aria-label="Main"
      sx={{
        width: 64,
        flexShrink: 0,
        bgcolor: tokens.surface,
        borderRight: `1px solid ${tokens.border}`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 0.75,
        py: 1.5,
      }}
    >
      {items.map((item) => {
        const active = item.active(pathname);
        return (
          <Tooltip key={item.label} title={item.label} placement="right">
            <IconButton
              component={Link}
              to={item.to}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              sx={{
                width: 40,
                height: 40,
                borderRadius: 2,
                color: active ? tokens.brand : tokens.textMuted,
                bgcolor: active ? tokens.brandSoft : "transparent",
                "&:hover": {
                  bgcolor: active ? tokens.brandSoft : tokens.subtle,
                },
              }}
            >
              {item.icon}
            </IconButton>
          </Tooltip>
        );
      })}
    </Box>
  );
};

export default NavRail;
