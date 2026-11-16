import React from "react";
import { staggerDelay } from "../../_helpers/motion.helper";

/**
 * Props that make the i-th row of a list part of a cascade: it rises into
 * place a little after the one before (REQ-018-21). Spread onto the row.
 */
export const staggered = (index: number, visibleRows?: number) => ({
  className: "v-enter",
  style: {
    "--v-delay": `${staggerDelay(index, visibleRows)}ms`,
  } as React.CSSProperties,
});
