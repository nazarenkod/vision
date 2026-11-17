import React from "react";
import { Box } from "@mui/material";
import { radius, tokens, type } from "../../theme";
import { useT } from "../../i18n";
import { DiffPiece, wordDiff } from "../../_helpers/wordDiff.helper";

const Line: React.FunctionComponent<{
  pieces: DiffPiece[];
  side: "before" | "after";
}> = ({ pieces, side }) => {
  const tone = side === "before" ? tokens.status.failed : tokens.status.passed;
  if (!pieces.length) return <Box component="span">—</Box>;
  return (
    <Box
      component="span"
      data-testid={side === "before" ? "changedBefore" : "changedAfter"}
      sx={{ color: tokens.text, overflowWrap: "anywhere" }}
    >
      {pieces.map((piece, index) =>
        piece.changed ? (
          <Box
            key={index}
            component={side === "before" ? "del" : "ins"}
            data-testid="changedWord"
            sx={{
              bgcolor: tone.bg,
              color: tone.fg,
              textDecoration: side === "before" ? "line-through" : "none",
              fontWeight: side === "after" ? 600 : 400,
              borderRadius: radius.control,
              px: 0.25,
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
};

/**
 * A text that changed, as two aligned lines with only the differing words
 * marked (REQ-069-04, 05): two whole sentences side by side made people hunt
 * for the difference by eye.
 */
export const BeforeAfter: React.FunctionComponent<{
  before: string;
  after: string;
}> = ({ before, after }) => {
  const { t } = useT();
  const diff = wordDiff(before, after);
  const label = {
    color: tokens.textMuted,
    fontSize: type.caption,
    fontWeight: 600,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    lineHeight: 1.6,
  } as const;
  return (
    <Box
      data-testid="beforeAfter"
      sx={{
        display: "grid",
        gridTemplateColumns: "auto minmax(0, 1fr)",
        columnGap: 1,
        rowGap: 0.25,
        mt: 0.25,
        fontSize: type.small,
        lineHeight: 1.5,
      }}
    >
      <Box sx={label}>{t("changes.before")}</Box>
      <Line pieces={diff.before} side="before" />
      <Box sx={label}>{t("changes.after")}</Box>
      <Line pieces={diff.after} side="after" />
    </Box>
  );
};
