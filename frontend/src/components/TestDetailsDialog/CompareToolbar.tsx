import React from "react";
import {
  Box,
  Divider,
  FormControlLabel,
  Slider,
  Switch,
  ToggleButton,
} from "@mui/material";
import { SlidingToggleGroup } from "../motion/SlidingToggleGroup";
import { Tooltip as MuiTooltip } from "@mui/material";
import { tokens, type } from "../../theme";
import { useT } from "../../i18n";

/** How Current is laid against the baseline. */
export type CompareView = "side" | "overlay" | "fade";

const group = {
  display: "flex",
  alignItems: "center",
  gap: 1.5,
  flexWrap: "nowrap",
  minWidth: 0,
} as const;

/**
 * The comparison's one toolbar (REQ-046-02): the device; the changed share;
 * the view and Highlight diff; Select elements and Areas on the right. Groups
 * are kept whole: a narrow window moves a group to the next row, never a
 * control on its own.
 */
export const CompareToolbar: React.FunctionComponent<{
  devices: React.ReactNode;
  meter: React.ReactNode;
  /** a baseline to lay Current against: without one there is no view */
  canCompare: boolean;
  view: CompareView;
  onView: (view: CompareView) => void;
  fade: number;
  onFade: (fade: number) => void;
  /** the server made a diff image to highlight */
  hasDiff: boolean;
  diffShown: boolean;
  onDiffShown: (shown: boolean) => void;
  tools: React.ReactNode;
}> = ({
  devices,
  meter,
  canCompare,
  view,
  onView,
  fade,
  onFade,
  hasDiff,
  diffShown,
  onDiffShown,
  tools,
}) => {
  const { t } = useT();
  const divider = <Divider orientation="vertical" flexItem sx={{ my: 1.5 }} />;
  const segment = (value: CompareView, label: string, help: string) => (
    <ToggleButton
      value={value}
      data-testid={value === "overlay" ? "differenceToggle" : `view-${value}`}
      sx={{
        height: 28,
        px: 1.25,
        py: 0,
        border: 0,
        fontSize: type.small,
        fontWeight: view === value ? 600 : 500,
        textTransform: "none",
        whiteSpace: "nowrap",
        color: view === value ? tokens.text : tokens.textSecondary,
      }}
    >
      <MuiTooltip title={help} describeChild arrow disableInteractive>
        <span>{label}</span>
      </MuiTooltip>
    </ToggleButton>
  );
  const viewGroup = canCompare || hasDiff;
  return (
    <Box
      data-testid="compareToolbar"
      role="group"
      aria-label={t("compare.toolbar")}
      sx={{
        display: "flex",
        alignItems: "stretch",
        flexWrap: "wrap",
        columnGap: 2,
        minHeight: 52,
        px: 3,
        borderBottom: `1px solid ${tokens.border}`,
        bgcolor: tokens.surface,
        fontSize: type.small,
        color: tokens.textSecondary,
        flexShrink: 0,
      }}
    >
      <Box data-testid="toolbarDevices" sx={group}>
        {devices}
      </Box>
      {divider}
      <Box data-testid="toolbarMeter" sx={group}>
        {meter}
      </Box>
      {viewGroup && divider}
      {viewGroup && (
        <Box data-testid="toolbarView" sx={group}>
          {canCompare && (
            <SlidingToggleGroup
              exclusive
              size="small"
              value={view}
              aria-label={t("compare.view")}
              onChange={(_, value: CompareView | null) =>
                value && onView(value)
              }
              sx={{ bgcolor: tokens.subtle, p: "2px" }}
            >
              {segment(
                "side",
                t("compare.sideBySide"),
                t("compare.sideBySide"),
              )}
              {segment("overlay", t("compare.overlay"), t("review.blendHelp"))}
              {segment("fade", t("compare.fade"), t("review.fadeHelp"))}
            </SlidingToggleGroup>
          )}
          {canCompare && view === "fade" && (
            <Box width={96} display="flex" data-testid="overlayOpacity">
              <Slider
                size="small"
                min={0}
                max={1}
                step={0.05}
                value={fade}
                onChange={(_, value) => onFade(value as number)}
                aria-label={t("review.fadeLabel")}
              />
            </Box>
          )}
          {hasDiff && (
            <MuiTooltip
              title={t("compare.highlightDiffHelp")}
              describeChild
              arrow
              disableInteractive
            >
              <FormControlLabel
                data-testid="highlightDiff"
                sx={{ m: 0, gap: 1, whiteSpace: "nowrap" }}
                control={
                  <Switch
                    size="small"
                    checked={diffShown}
                    onChange={(event) => onDiffShown(event.target.checked)}
                    name="Highlight diff"
                  />
                }
                label={
                  <Box
                    component="span"
                    sx={{ fontSize: type.small, color: tokens.textSecondary }}
                  >
                    {t("compare.highlightDiff")}
                  </Box>
                }
              />
            </MuiTooltip>
          )}
        </Box>
      )}
      <Box
        data-testid="toolbarTools"
        sx={{ ...group, ml: "auto", gap: 1, py: 1 }}
      >
        {tools}
      </Box>
    </Box>
  );
};
