import React from "react";
import { Toolbar, Box } from "@mui/material";
import { BulkOperation } from "./BulkOperation";
import {
  TestRunDensity,
  TestRunListControls,
  TestRunView,
  TOOLBAR_SX,
} from "./TestRunListControls";
import { TestRun } from "../../types";

// how the data grid learns the types of the props passed via slotProps.toolbar
declare module "@mui/x-data-grid" {
  interface ToolbarPropsOverrides {
    selectedIds: string[];
    rows: TestRun[];
    view: TestRunView;
    onViewChange: (view: TestRunView) => void;
    density: TestRunDensity;
    onDensityChange: (density: TestRunDensity) => void;
    showDiff: boolean;
    onShowDiffChange: (showDiff: boolean) => void;
    onProcessed: () => void;
  }
}

export const DataGridCustomToolbar: React.FunctionComponent<{
  selectedIds: string[];
  rows: TestRun[];
  view: TestRunView;
  onViewChange: (view: TestRunView) => void;
  density: TestRunDensity;
  onDensityChange: (density: TestRunDensity) => void;
  showDiff: boolean;
  onShowDiffChange: (showDiff: boolean) => void;
  onProcessed: () => void;
}> = ({
  selectedIds,
  rows,
  view,
  onViewChange,
  density,
  onDensityChange,
  showDiff,
  onShowDiffChange,
  onProcessed,
}) => (
  <Toolbar variant="dense" sx={TOOLBAR_SX}>
    <TestRunListControls
      view={view}
      onViewChange={onViewChange}
      density={density}
      onDensityChange={onDensityChange}
      showDiff={showDiff}
      onShowDiffChange={onShowDiffChange}
    />
    <Box marginLeft="auto" display="flex" flexShrink={0}>
      <BulkOperation
        selectedIds={selectedIds}
        rows={rows}
        selectionNoun="rows"
        onProcessed={onProcessed}
      />
    </Box>
  </Toolbar>
);
