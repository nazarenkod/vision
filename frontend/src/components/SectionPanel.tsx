import React from "react";
import { Box, Tooltip } from "@mui/material";
import { useT } from "../i18n";
import type { HeadingState } from "../_helpers/sideNav.helper";
import { PROJECT_HEADING_TEST_ID } from "./SideNav.locators";
import { tokens, type } from "../theme";

export const PANEL_WIDTH = 200;

const ellipsis = {
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
} as const;

/**
 * The panel next to the rail (spec 057): the chosen project's name, its sections,
 * and Administration at the bottom for admins (REQ-057-10…15).
 */
export const SectionPanel: React.FunctionComponent<{
  heading: HeadingState;
  sections: React.ReactNode;
  admin?: React.ReactNode;
}> = ({ heading, sections, admin }) => {
  const { t } = useT();
  const title = heading.kind === "project" ? heading.name : t(heading.label);

  return (
    <Box
      sx={{
        width: PANEL_WIDTH,
        flexShrink: 0,
        height: "100%",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: 0.25,
        pt: 2.75,
        pb: 2,
        px: 1.5,
      }}
    >
      <Box
        data-testid={PROJECT_HEADING_TEST_ID}
        data-state={heading.kind}
        sx={{ px: 1.25, mb: 2.25, minWidth: 0 }}
      >
        <Tooltip title={heading.kind === "project" ? title : ""}>
          <Box
            component="div"
            sx={{
              ...ellipsis,
              m: 0,
              fontSize: heading.kind === "project" ? type.section : type.body,
              fontWeight: heading.kind === "project" ? 700 : 600,
              lineHeight: 1.25,
              letterSpacing: heading.kind === "project" ? "-0.02em" : 0,
              color:
                heading.kind === "project" ? tokens.text : tokens.textMuted,
            }}
          >
            {title}
          </Box>
        </Tooltip>
        <Box
          component="span"
          sx={{ fontSize: type.caption, color: tokens.textMuted }}
        >
          {t("nav.project")}
        </Box>
      </Box>

      <Box
        component="div"
        role="group"
        aria-label={t("nav.sections")}
        sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}
      >
        {sections}
      </Box>

      <Box sx={{ flex: 1, minHeight: 16 }} />

      {admin && (
        <Box
          role="group"
          aria-labelledby="sideNavAdmin"
          sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}
        >
          <Box
            id="sideNavAdmin"
            sx={{
              px: 1.25,
              pb: 0.75,
              fontSize: type.caption,
              fontWeight: 500,
              color: tokens.textMuted,
            }}
          >
            {t("nav.admin")}
          </Box>
          {admin}
        </Box>
      )}
    </Box>
  );
};
