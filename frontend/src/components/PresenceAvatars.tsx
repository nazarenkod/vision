import React from "react";
import { Box, Tooltip, Typography } from "@mui/material";
import { useViewersOn } from "../contexts/presence.context";
import { initialsOf } from "../_helpers/presence.helper";
import { radius, tokens, type } from "../theme";
import { useT } from "../i18n";

const SHOWN = 3;

/** Colleagues who have the screen open now (056); nothing when nobody does. */
export const PresenceAvatars: React.FunctionComponent<{
  testRunId: string;
  // in the comparison the avatars say «here too»; on a tile the tooltip is enough
  withLabel?: boolean;
}> = ({ testRunId, withLabel }) => {
  const { t } = useT();
  const viewers = useViewersOn(testRunId);
  if (!viewers.length) return null;
  const names = viewers.map((viewer) => viewer.name).join(", ");
  return (
    <Tooltip title={t("presence.here", { names })}>
      <Box
        data-testid="presence"
        aria-label={t("presence.here", { names })}
        sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}
      >
        <Box sx={{ display: "flex" }}>
          {viewers.slice(0, SHOWN).map((viewer, index) => (
            <Box
              key={viewer.userId}
              aria-hidden
              sx={{
                width: 22,
                height: 22,
                ml: index ? -0.75 : 0,
                borderRadius: radius.pill,
                display: "grid",
                placeItems: "center",
                bgcolor: tokens.variable,
                color: tokens.surface,
                border: `2px solid ${tokens.surface}`,
                fontSize: type.caption,
                fontWeight: 700,
                lineHeight: 1,
              }}
            >
              {initialsOf(viewer.name)}
            </Box>
          ))}
        </Box>
        {withLabel && (
          <Typography
            sx={{ fontSize: type.small, color: tokens.textSecondary }}
          >
            {t("presence.alsoHere")}
          </Typography>
        )}
      </Box>
    </Tooltip>
  );
};
