import React from "react";
import { Box, Typography } from "@mui/material";
import { TestRun } from "../../types";
import { Tooltip } from "../Tooltip";
import { radius, tokens } from "../../theme";
import { useT } from "../../i18n";

interface IProps {
  testRun: TestRun;
}

/**
 * What a vision model said about the screen, under the toolbar. The device
 * and the diff that used to sit here are in the toolbar now (REQ-046-02).
 */
export const TestRunDetails: React.FunctionComponent<IProps> = ({
  testRun,
}) => {
  const { t } = useT();
  if (!testRun.vlmDescription) return null;
  return (
    <Box sx={{ px: 3, py: 1, borderBottom: `1px solid ${tokens.border}` }}>
      <Tooltip title={t("review.vlmHelp")}>
        <Box
          sx={{
            p: 1.5,
            bgcolor: tokens.subtle,
            // a tinted block, not a coloured edge: no card carries a side stripe (spec 046)
            borderRadius: radius.control,
          }}
        >
          <Typography
            variant="caption"
            sx={{
              fontWeight: 600,
              display: "block",
              mb: 0.5,
              color: tokens.textSecondary,
            }}
          >
            {t("review.vlm")}
          </Typography>
          <Typography
            variant="body2"
            sx={{
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              lineHeight: 1.6,
            }}
          >
            {testRun.vlmDescription}
          </Typography>
        </Box>
      </Tooltip>
    </Box>
  );
};
