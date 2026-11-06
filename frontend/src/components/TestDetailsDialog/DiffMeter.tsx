import React from "react";
import { Box } from "@mui/material";
import { tokens } from "../../theme";
import { Tooltip } from "../Tooltip";
import { useT } from "../../i18n";

/**
 * "N% changed · M% allowed" in words (REQ-047-06): a bar under two numbers
 * read as a slider, though nothing here moves. The changed share takes the
 * failed colour when it is over the tolerance. Without a tolerance only the
 * changed share is said.
 */
export const DiffMeter: React.FunctionComponent<{
  diffPercent: number;
  tolerancePercent: number;
}> = ({ diffPercent, tolerancePercent }) => {
  const { t, formatNumber } = useT();
  // both numbers the same way: two decimals at most, the language's mark
  const percent = (value: number) =>
    formatNumber(Math.round((value || 0) * 100) / 100);
  const diff = percent(diffPercent);
  const tolerance = percent(tolerancePercent);
  const withTolerance = (tolerancePercent || 0) > 0;
  const over = withTolerance && (diffPercent || 0) > tolerancePercent;
  // the number stands out of the sentence, wherever the language puts it
  const changed = t("compare.changed", { value: diff });
  const at = changed.indexOf(`${diff}%`);
  return (
    <Tooltip title={t("review.diffMeterHelp", { diff, tolerance })}>
      <Box
        data-testid="diffMeter"
        data-over={over || undefined}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.75,
          whiteSpace: "nowrap",
          color: tokens.textSecondary,
        }}
      >
        <Box component="span" data-testid="diffChanged">
          {at < 0 ? (
            changed
          ) : (
            <>
              {changed.slice(0, at)}
              <Box
                component="b"
                data-testid="diffValue"
                sx={{
                  fontWeight: 600,
                  color: over ? tokens.status.failed.fg : tokens.text,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {diff}%
              </Box>
              {changed.slice(at + diff.length + 1)}
            </>
          )}
        </Box>
        {withTolerance && (
          <>
            <Box component="span" aria-hidden="true">
              ·
            </Box>
            <Box
              component="span"
              data-testid="diffAllowed"
              sx={{ fontVariantNumeric: "tabular-nums" }}
            >
              {t("compare.allowed", { value: tolerance })}
            </Box>
          </>
        )}
      </Box>
    </Tooltip>
  );
};
