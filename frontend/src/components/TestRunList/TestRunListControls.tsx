import React from "react";
import {
  Box,
  Divider,
  FormControlLabel,
  Switch,
  ToggleButton,
  Tooltip as MuiTooltip,
  TooltipProps,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { visuallyHidden } from "@mui/utils";
import {
  DensityLarge,
  DensityMedium,
  DensitySmall,
  ViewList,
  ViewModule,
} from "@mui/icons-material";
import { SlidingToggleGroup } from "../motion/SlidingToggleGroup";
import { Tooltip } from "../Tooltip";
import { useT } from "../../i18n";
import { GridSortButton, TestRunSort } from "./TestRunGridHeader";

/**
 * The list's toolbar keeps the controls and the bulk actions in one row; only
 * a window narrower than this lets the actions go under them (046).
 */
export const TOOLBAR_SX = {
  gap: 1,
  px: { xs: 2 },
  flexWrap: "nowrap",
  "@media (max-width:1099.95px)": { flexWrap: "wrap" },
} as const;

export type TestRunView = "table" | "grid";

// the data grid's own density values, so it can take this straight as a prop
export type TestRunDensity = "compact" | "standard" | "comfortable";

export const CARD_SIZE_BY_DENSITY: Record<
  TestRunDensity,
  { width: number; imageHeight: number }
> = {
  // phone screens are portrait: a card is as tall as the screenshot is
  compact: { width: 120, imageHeight: 210 },
  // four to a row in the main area at 1440 px beside the sidebar and the
  // build list (spec 046), each still half as tall again as it is wide
  standard: { width: 176, imageHeight: 300 },
  comfortable: { width: 210, imageHeight: 390 },
};

// a narrow window keeps the toolbar in one row: the switch without its words,
// still named for screen readers and in its tooltip (046)
const COMPACT_QUERY = "(max-width:1359.95px)";

const switchLabel = (text: string, compact: boolean) => (
  <Typography variant="body2" noWrap sx={compact ? visuallyHidden : undefined}>
    {text}
  </Typography>
);

const groupDivider = (
  <Divider orientation="vertical" flexItem sx={{ marginY: 1, marginX: 0.25 }} />
);

/**
 * A toggle button with a tooltip that appears at once. Two traps live here:
 * the app's Tooltip wrapper forwards only title and children, so the props the
 * group hands down would vanish, and ToggleButtonGroup reads `value` off its
 * direct child to decide which button is selected. Hence MUI's tooltip, the
 * rest spread through it, and the value on both.
 */
type IconToggleProps = {
  value: string;
  title: string;
  ariaLabel: string;
  testId: string;
  icon: React.ReactNode;
} & Omit<TooltipProps, "title" | "children">;

const IconToggle: React.FunctionComponent<IconToggleProps> = ({
  value,
  title,
  ariaLabel,
  testId,
  icon,
  ...rest
}) => (
  // not interactive: the tooltip opens over the list below, and an
  // interactive one would swallow clicks meant for it
  <MuiTooltip
    title={title}
    placement="bottom"
    arrow
    disableInteractive
    {...rest}
  >
    <ToggleButton
      value={value}
      aria-label={ariaLabel}
      data-testid={testId}
      sx={{ p: "5px" }}
    >
      {icon}
    </ToggleButton>
  </MuiTooltip>
);

export const TestRunListControls: React.FunctionComponent<{
  view: TestRunView;
  onViewChange: (view: TestRunView) => void;
  density: TestRunDensity;
  onDensityChange: (density: TestRunDensity) => void;
  showDiff: boolean;
  onShowDiffChange: (showDiff: boolean) => void;
  // the cards' order; the table sorts by its column heads instead
  sort?: TestRunSort;
  onSortChange?: (sort: TestRunSort) => void;
}> = ({
  view,
  onViewChange,
  density,
  onDensityChange,
  showDiff,
  onShowDiffChange,
  sort,
  onSortChange,
}) => {
  const { t } = useT();
  const compact = useMediaQuery(COMPACT_QUERY, { noSsr: true });
  return (
    // shrinks before the bulk actions beside it go to a second row (046)
    <Box display="flex" alignItems="center" gap={0.75} minWidth={0}>
      {/* laid out as a table or a grid */}
      <SlidingToggleGroup
        rememberAs="testRunView"
        exclusive
        size="small"
        value={view}
        onChange={(event, next: TestRunView | null) =>
          next && onViewChange(next)
        }
      >
        <IconToggle
          value="table"
          title={t("runs.table")}
          ariaLabel={t("runs.tableView")}
          testId="tableViewToggle"
          icon={<ViewList fontSize="small" />}
        />
        <IconToggle
          value="grid"
          title={t("runs.grid")}
          ariaLabel={t("runs.gridView")}
          testId="gridViewToggle"
          icon={<ViewModule fontSize="small" />}
        />
      </SlidingToggleGroup>
      {groupDivider}
      <SlidingToggleGroup
        exclusive
        size="small"
        value={density}
        onChange={(event, next: TestRunDensity | null) =>
          next && onDensityChange(next)
        }
      >
        <IconToggle
          value="compact"
          title={t("runs.compact")}
          ariaLabel={t("runs.compactDensity")}
          testId="compactDensity"
          icon={<DensitySmall fontSize="small" />}
        />
        <IconToggle
          value="standard"
          title={t("runs.standard")}
          ariaLabel={t("runs.standardDensity")}
          testId="standardDensity"
          icon={<DensityMedium fontSize="small" />}
        />
        <IconToggle
          value="comfortable"
          title={t("runs.comfortable")}
          ariaLabel={t("runs.comfortableDensity")}
          testId="comfortableDensity"
          icon={<DensityLarge fontSize="small" />}
        />
      </SlidingToggleGroup>
      {view === "grid" && sort && onSortChange && groupDivider}
      {view === "grid" && sort && onSortChange && (
        <Box flexShrink={0}>
          <GridSortButton sort={sort} onSortChange={onSortChange} />
        </Box>
      )}
      {/* only the cards carry a picture, so the table has nothing to swap; a
        switch rather than an icon, so "on" is unmistakable */}
      {view === "grid" && groupDivider}
      {view === "grid" && (
        <Tooltip
          title={
            compact
              ? `${t("runs.showDiff")} · ${t("runs.diffHelp")}`
              : t("runs.diffHelp")
          }
        >
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={showDiff}
                onChange={(event) => onShowDiffChange(event.target.checked)}
                inputProps={{ "aria-label": t("runs.showDiff") }}
                data-testid="showDiffToggle"
              />
            }
            label={switchLabel(t("runs.showDiff"), compact)}
            sx={{ marginLeft: 0, marginRight: 0, minWidth: 0 }}
          />
        </Tooltip>
      )}
    </Box>
  );
};
