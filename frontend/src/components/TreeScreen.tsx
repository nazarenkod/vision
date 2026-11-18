import React from "react";
import { Box, Typography } from "@mui/material";
import { staticService } from "../services";
import { radius, tokens } from "../theme";
import { TreeOutline } from "../_helpers/treeInspector.helper";

export type Point = { x: number; y: number };

/** A screenshot with the tree's outlines over it; the pointer reports in its pixels. */
export const TreeScreen: React.FunctionComponent<{
  title: string;
  // the test id of the screenshot; by its title when not given
  testId?: string;
  // the title above the screenshot; the pair names its versions in their own heading
  caption?: boolean;
  imageName: string | null | undefined;
  outlines: TreeOutline[];
  onPoint: (point: Point | null) => void;
  onPick: (point: Point) => void;
}> = ({
  title,
  testId,
  caption = true,
  imageName,
  outlines,
  onPoint,
  onPick,
}) => {
  const [size, setSize] = React.useState<{ width: number; height: number }>();
  const at = (event: React.MouseEvent<HTMLElement>): Point | null => {
    if (!size) return null;
    const box = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - box.left) / box.width) * size.width,
      y: ((event.clientY - box.top) / box.height) * size.height,
    };
  };
  const percent = (value: number, of: number) => `${(value / of) * 100}%`;
  return (
    <Box
      component="figure"
      sx={{
        m: 0,
        flex: "1 1 240px",
        minWidth: 0,
        maxWidth: 420,
        display: "flex",
        flexDirection: "column",
        gap: 1,
      }}
    >
      {caption && (
        <Typography
          component="figcaption"
          variant="subtitle2"
          color="textSecondary"
        >
          {title}
        </Typography>
      )}
      {imageName ? (
        <Box
          data-testid={testId ?? `inspectScreen-${title}`}
          onMouseMove={(event) => onPoint(at(event))}
          onMouseLeave={() => onPoint(null)}
          onClick={(event) => {
            const point = at(event);
            if (point) onPick(point);
          }}
          sx={{
            position: "relative",
            cursor: "pointer",
            borderRadius: radius.control,
            overflow: "hidden",
            boxShadow: tokens.shadowShot,
            lineHeight: 0,
          }}
        >
          <Box
            component="img"
            src={staticService.getImage(imageName)}
            alt={title}
            onLoad={(event: React.SyntheticEvent<HTMLImageElement>) =>
              setSize({
                width: event.currentTarget.naturalWidth,
                height: event.currentTarget.naturalHeight,
              })
            }
            sx={{ width: "100%", height: "auto", display: "block" }}
          />
          {size &&
            outlines.map((outline) => (
              <Box
                key={outline.id}
                aria-hidden
                data-testid={
                  outline.dashed ? "outlinePointed" : "outlineChosen"
                }
                sx={{
                  position: "absolute",
                  pointerEvents: "none",
                  left: percent(outline.rect.x, size.width),
                  top: percent(outline.rect.y, size.height),
                  width: percent(outline.rect.width, size.width),
                  height: percent(outline.rect.height, size.height),
                  boxSizing: "border-box",
                  border: `2px ${outline.dashed ? "dashed" : "solid"} ${tokens.brand}`,
                  bgcolor: outline.dashed ? "transparent" : tokens.brandSoft,
                  opacity: outline.dashed ? 1 : 0.85,
                }}
              />
            ))}
        </Box>
      ) : null}
    </Box>
  );
};
