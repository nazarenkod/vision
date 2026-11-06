import React from "react";
import { Box } from "@mui/material";
import { diffMeter } from "../../_helpers/review.helper";
import { motion, tokens, radius } from "../../theme";
import { Tooltip } from "../Tooltip";
import { useT } from "../../i18n";

/**
 * "N% changed" against "M% allowed" on one static bar: the allowed share is a
 * tick, not a handle, since nothing here can be dragged (REQ-018-31,
 * REQ-046-03). Without a tolerance only the changed share is said.
 */
export const DiffMeter: React.FunctionComponent<{
  diffPercent: number;
  tolerancePercent: number;
}> = ({ diffPercent, tolerancePercent }) => {
  const meter = diffMeter(diffPercent, tolerancePercent);
  const { t, formatNumber } = useT();
  // both numbers the same way: two decimals at most, the language's mark
  const percent = (value: number) =>
    formatNumber(Math.round((value || 0) * 100) / 100);
  const diff = percent(diffPercent);
  const tolerance = percent(tolerancePercent);
  const withTolerance = (tolerancePercent || 0) > 0;
  // the number stands out of the sentence, wherever the language puts it
  const changed = t("compare.changed", { value: diff });
  const at = changed.indexOf(`${diff}%`);
  return (
    <Tooltip title={t("review.diffMeterHelp", { diff, tolerance })}>
      <Box
        data-testid="diffMeter"
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.25,
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
                  color: meter.over ? tokens.status.failed.fg : tokens.text,
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
            <Box
              aria-hidden="true"
              sx={{
                position: "relative",
                width: 96,
                height: 6,
                borderRadius: radius.pill,
                bgcolor: tokens.border,
              }}
            >
              <Box
                data-testid="diffFill"
                style={{ width: `${meter.fill}%` }}
                sx={{
                  position: "absolute",
                  inset: "0 auto 0 0",
                  borderRadius: radius.pill,
                  bgcolor: meter.over
                    ? tokens.status.failed.bar
                    : tokens.status.changed.bar,
                  transformOrigin: "left",
                  animation: `v-fill ${motion.slow * 2}ms ${motion.easing} both`,
                }}
              />
              <Box
                data-testid="toleranceMark"
                style={{ left: `${meter.mark}%` }}
                sx={{
                  position: "absolute",
                  top: -4,
                  width: 2,
                  height: 14,
                  ml: "-1px",
                  bgcolor: tokens.textSecondary,
                }}
              />
            </Box>
            <Box
              component="span"
              data-testid="diffAllowed"
              sx={{ color: tokens.textMuted }}
            >
              {t("compare.allowed", { value: tolerance })}
            </Box>
          </>
        )}
      </Box>
    </Tooltip>
  );
};
