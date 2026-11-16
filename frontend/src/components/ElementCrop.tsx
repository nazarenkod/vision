import React from "react";
import { Box } from "@mui/material";
import { staticService } from "../services";
import { radius, tokens } from "../theme";
import type { Rect } from "../types";
import { cropLayout } from "../_helpers/elementCrop.helper";

interface Props {
  imageName: string | null;
  box: Rect;
  // the screen in the pixels the box is in: the UI tree's size of the screenshot
  image: { width: number; height: number };
  width: number;
  maxHeight: number;
  // a change is outlined in the diff colour, a found element in the brand colour
  tone?: "found" | "changed" | "none";
  alt?: string;
  testId?: string;
}

/** One element cut out of a screen with a little of what is around it (053, 055). */
export const ElementCrop: React.FunctionComponent<Props> = ({
  imageName,
  box,
  image,
  width,
  maxHeight,
  tone = "none",
  alt = "",
  testId,
}) => {
  const layout = cropLayout(box, image, width, maxHeight);
  const outline =
    tone === "found" ? tokens.brand : tone === "changed" ? tokens.diff : null;
  return (
    <Box
      data-testid={testId}
      sx={{
        position: "relative",
        width: layout.boxWidth,
        height: layout.boxHeight,
        maxWidth: "100%",
        overflow: "hidden",
        borderRadius: radius.control,
        bgcolor: tokens.subtle,
        border: `1px solid ${outline ?? tokens.border}`,
        boxShadow: outline ? `0 0 0 1px ${outline} inset` : "none",
      }}
    >
      <Box
        component="img"
        src={staticService.getImage(imageName)}
        alt={alt}
        loading="lazy"
        sx={{
          position: "absolute",
          left: layout.left,
          top: layout.top,
          width: layout.imageWidth,
          height: layout.imageHeight,
          maxWidth: "none",
        }}
      />
    </Box>
  );
};
