import React from "react";
import { Box, IconButton, Link } from "@mui/material";
import { WarningRounded, WarningAmberRounded } from "@mui/icons-material";
import { IgnoreArea } from "../../types/ignoreArea";
import { Tooltip } from "../Tooltip";
import { BranchTag } from "../DeviceTags";
import { tokens, type, radius } from "../../theme";
import { useT } from "../../i18n";

export interface ImageDetailsProps {
  type: "Baseline" | "Image" | "Diff";
  // nullable like the run's own names: this already renders "Loading..." for a
  // missing one, so the guard was there before the type admitted it
  imageName: string | null;
  image: HTMLImageElement | undefined;
  branchName: string;
  ignoreAreas?: IgnoreArea[];
  /** Current is not the baseline's size: said next to it instead of its size (REQ-046-04) */
  sizeDiffers?: boolean;
  /** the baseline's history, opened in a new tab */
  onHistory?: () => void;
}

/**
 * The head of one image column: BASELINE or CURRENT, the branch, the size and
 * the baseline's history (spec 046).
 */
const ImageDetails: React.FunctionComponent<ImageDetailsProps> = ({
  type: kind,
  image,
  imageName,
  branchName,
  ignoreAreas,
  sizeDiffers,
  onHistory,
}) => {
  const { t } = useT();
  const size = image ? `${image.width} × ${image.height}` : t("review.loading");
  return (
    <Box
      data-testid={kind === "Baseline" ? "baselineHeader" : "currentHeader"}
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 1.25,
        height: 24,
        minWidth: 0,
        whiteSpace: "nowrap",
        fontSize: type.small,
        color: tokens.textSecondary,
      }}
    >
      <Box
        component="span"
        sx={{
          fontSize: type.caption,
          fontWeight: 600,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: tokens.text,
        }}
      >
        {t(kind === "Baseline" ? "review.baseline" : "review.checkpoint")}
      </Box>
      {branchName && (
        <Tooltip title={t("review.branch", { branch: branchName })}>
          <BranchTag
            branch={branchName}
            sx={{ bgcolor: tokens.surface, maxWidth: 200, minWidth: 0 }}
          />
        </Tooltip>
      )}
      {imageName &&
        (sizeDiffers && image ? (
          <Tooltip title={t("review.sizeDiffers")}>
            <Box
              component="span"
              data-testid="sizeDiffers"
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.5,
                height: 22,
                px: 1,
                borderRadius: radius.pill,
                bgcolor: tokens.status.changed.bg,
                color: tokens.status.changed.fg,
                fontSize: type.caption,
                fontWeight: 600,
              }}
            >
              <WarningAmberRounded sx={{ fontSize: type.small }} />
              {t("compare.sizeDiffers", {
                width: image.width,
                height: image.height,
              })}
            </Box>
          </Tooltip>
        ) : (
          <Box
            component="span"
            data-testid="image-size"
            sx={{ fontVariantNumeric: "tabular-nums", color: tokens.textMuted }}
          >
            {size}
          </Box>
        ))}
      {onHistory && (
        <Link
          component="button"
          type="button"
          onClick={onHistory}
          data-testid="historyLink"
          sx={{ fontSize: type.small, fontWeight: 600 }}
        >
          {t("review.history")}
        </Link>
      )}
      {ignoreAreas && ignoreAreas.length > 0 && (
        <Tooltip title={t("review.uploadIgnore")}>
          <IconButton size="small">
            <WarningRounded color="secondary" fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
};

export default ImageDetails;
