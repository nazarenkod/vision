import React from "react";
import { Box, IconButton, Tooltip } from "@mui/material";
import { Link, useLocation } from "react-router-dom";
import {
  FolderOutlined,
  ViewAgendaOutlined,
  GridViewOutlined,
  InsightsOutlined,
  PeopleOutline,
  PersonOutline,
} from "@mui/icons-material";
import { useProjectState, useUserState } from "../contexts";
import { routes } from "../constants";
import { motion, tokens } from "../theme";

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
          {
            label: "Insights",
            to: `${routes.INSIGHTS_PAGE}/${selectedProjectId}`,
            icon: <InsightsOutlined />,
            active: (path: string) => path.startsWith(routes.INSIGHTS_PAGE),
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

  const activeIndex = items.findIndex((item) => item.active(pathname));
  const buttons = React.useRef<Array<HTMLAnchorElement | null>>([]);
  const [indicatorTop, setIndicatorTop] = React.useState<number | null>(null);
  // the highlight travels to the new item instead of jumping (REQ-018-22)
  React.useLayoutEffect(() => {
    const button = buttons.current[activeIndex];
    setIndicatorTop(button ? button.offsetTop : null);
  }, [activeIndex, items.length]);

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
        position: "relative",
      }}
    >
      <Box
        aria-hidden="true"
        data-testid="navIndicator"
        sx={{
          position: "absolute",
          left: 12,
          top: 0,
          width: 40,
          height: 40,
          borderRadius: 2,
          bgcolor: tokens.brandSoft,
          opacity: indicatorTop === null ? 0 : 1,
          transform: `translateY(${indicatorTop ?? 0}px)`,
          transition: `transform ${motion.nav}ms ${motion.easing}, opacity ${motion.fast}ms`,
          "[data-theme='dark'] &": {
            boxShadow: "0 0 18px -2px rgba(67, 196, 106, 0.35)",
          },
        }}
      />
      {items.map((item, index) => {
        const active = index === activeIndex;
        return (
          <Tooltip key={item.label} title={item.label} placement="right">
            <IconButton
              component={Link}
              to={item.to}
              ref={(element: HTMLAnchorElement | null) => {
                buttons.current[index] = element;
              }}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              sx={{
                width: 40,
                height: 40,
                borderRadius: 2,
                color: active ? tokens.brand : tokens.textMuted,
                transition: `color ${motion.nav}ms ${motion.easing}, background-color ${motion.fast}ms`,
                "&:hover": {
                  bgcolor: active ? "transparent" : tokens.subtle,
                  color: active ? tokens.brand : tokens.text,
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
