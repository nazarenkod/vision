import React from "react";
import { Box } from "@mui/material";
import { radius, tokens, type } from "../theme";

// soft pairs the theme already has, so the letter reads in both themes
const TONES = [
  { fg: tokens.brand, bg: tokens.brandSoft },
  { fg: tokens.status.new.fg, bg: tokens.status.new.bg },
  { fg: tokens.variable, bg: tokens.variableSoft },
  { fg: tokens.status.changed.fg, bg: tokens.status.changed.bg },
  { fg: tokens.status.neutral.fg, bg: tokens.status.neutral.bg },
];

/** The same project gets the same colour on every page and in every session. */
export const projectTone = (name: string): number => {
  let hash = 0;
  for (const char of name) {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  }
  return hash % TONES.length;
};

/** First letter of the project's name on a tinted square. */
export const ProjectAvatar: React.FunctionComponent<{
  name: string;
  size?: number;
}> = ({ name, size = 28 }) => {
  const tone = TONES[projectTone(name)];
  return (
    <Box
      component="span"
      aria-hidden
      sx={{
        width: size,
        height: size,
        flexShrink: 0,
        display: "inline-grid",
        placeItems: "center",
        borderRadius: radius.control,
        // the letter keeps to the type scale: small squares take the caption size
        fontSize: size >= 28 ? type.small : type.caption,
        fontWeight: 700,
        lineHeight: 1,
        color: tone.fg,
        bgcolor: tone.bg,
      }}
    >
      {Array.from(name.trim())[0]?.toUpperCase() ?? "?"}
    </Box>
  );
};
