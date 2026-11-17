import React from "react";
import { Box } from "@mui/material";
import { tokens, type } from "../../theme";
import { inlineDiff } from "../../_helpers/wordDiff.helper";

/**
 * A text that changed, in one line (REQ-074-04): the shared words once, the
 * old words crossed out in grey right before the new ones in green. Two whole
 * sentences, one above the other, made people hunt for the difference.
 */
export const BeforeAfter: React.FunctionComponent<{
  before: string;
  after: string;
}> = ({ before, after }) => (
  <Box
    component="span"
    data-testid="beforeAfter"
    sx={{
      display: "block",
      mt: 0.25,
      fontSize: type.small,
      lineHeight: 1.5,
      color: tokens.text,
      overflowWrap: "anywhere",
    }}
  >
    {inlineDiff(before, after).map((piece, index) =>
      piece.kind === "removed" ? (
        <Box
          key={index}
          component="del"
          data-testid="changedBefore"
          sx={{ color: tokens.textMuted }}
        >
          {piece.text}
        </Box>
      ) : piece.kind === "added" ? (
        <Box
          key={index}
          component="ins"
          data-testid="changedAfter"
          sx={{
            color: tokens.status.passed.fg,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          {piece.text}
        </Box>
      ) : (
        <React.Fragment key={index}>{piece.text}</React.Fragment>
      ),
    )}
  </Box>
);
