import { Tooltip as MuiTooltip, TooltipProps } from "@mui/material";
import React from "react";

export const Tooltip: React.FunctionComponent<TooltipProps> = ({
  title,
  children,
}) => (
  // never takes the pointer: an open tooltip used to cover the row or button
  // below it, so the next click went to the tooltip
  <MuiTooltip title={title} placement="bottom" arrow disableInteractive>
    {children}
  </MuiTooltip>
);
