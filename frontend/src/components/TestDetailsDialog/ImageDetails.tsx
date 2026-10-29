import React from "react";
import { Typography, Grid, IconButton } from "@mui/material";
import { WarningRounded, AltRoute } from "@mui/icons-material";
import { IgnoreArea } from "../../types/ignoreArea";
import { Tooltip } from "../Tooltip";
import { makeStyles } from "@mui/styles";
import { tokens } from "../../theme";
import { useT } from "../../i18n";

const useStyles = makeStyles(() => ({
  container: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    color: tokens.textSecondary,
  },
  branchName: {
    cursor: "pointer",
    lineHeight: "20px",
    fontSize: 12,
    fontFamily: tokens.mono,
    color: tokens.text,
    maxWidth: 195,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    overflow: "hidden",
  },
}));

export interface ImageDetailsProps {
  type: "Baseline" | "Image" | "Diff";
  // nullable like the run's own names: this already renders "Loading..." for a
  // missing one, so the guard was there before the type admitted it
  imageName: string | null;
  image: HTMLImageElement | undefined;
  branchName: string;
  ignoreAreas?: IgnoreArea[];
}

const ImageDetails: React.FunctionComponent<ImageDetailsProps> = ({
  type,
  image,
  imageName,
  branchName,
  ignoreAreas,
}) => {
  const classes = useStyles();
  const { t } = useT();
  const imageSize = () => {
    return (
      imageName && (
        <Typography
          variant="caption"
          sx={{ mr: 0.5, fontSize: 12, color: tokens.textMuted }}
          data-testid="image-size"
        >
          {image ? `(${image?.width} x ${image?.height})` : t("review.loading")}
        </Typography>
      )
    );
  };
  return (
    <Grid item className={classes.container}>
      <Typography
        variant="overline"
        sx={{
          color: tokens.text,
          fontWeight: 600,
          letterSpacing: "0.06em",
          mr: 0.5,
        }}
      >
        {t(type === "Baseline" ? "review.baseline" : "review.checkpoint")}
      </Typography>
      {imageSize()}
      <AltRoute fontSize="small" />
      <Tooltip title={t("review.branch", { branch: branchName })}>
        <span className={classes.branchName}>{branchName}</span>
      </Tooltip>
      {ignoreAreas && ignoreAreas.length > 0 && (
        <Tooltip title={t("review.uploadIgnore")}>
          <IconButton size="large">
            <WarningRounded color="secondary" />
          </IconButton>
        </Tooltip>
      )}
    </Grid>
  );
};

export default ImageDetails;
