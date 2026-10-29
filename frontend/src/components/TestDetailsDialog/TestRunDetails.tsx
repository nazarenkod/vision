import React from "react";
import { Chip, Grid, Typography, Paper, type Theme } from "@mui/material";
import { makeStyles } from "@mui/styles";
import { TestRun } from "../../types";
import { Tooltip } from "../Tooltip";
import { DiffMeter } from "./DiffMeter";
import { tokens } from "../../theme";
import { useT } from "../../i18n";

const useStyles = makeStyles((theme: Theme) => ({
  vlmContainer: {
    padding: theme.spacing(1.5),
    marginTop: theme.spacing(1),
    backgroundColor: tokens.subtle,
    borderLeft: "3px solid",
    borderColor: theme.palette.primary.main,
  },
  vlmLabel: {
    fontWeight: 600,
    display: "block",
    marginBottom: theme.spacing(0.5),
    color: theme.palette.text.secondary,
  },
  vlmDescription: {
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    lineHeight: 1.6,
  },
}));

interface IProps {
  testRun: TestRun;
}

export const TestRunDetails: React.FunctionComponent<IProps> = ({
  testRun,
}) => {
  const classes = useStyles();
  const { t } = useT();

  const attributes = [
    { name: t("review.attr.os"), value: testRun.os },
    { name: t("review.attr.device"), value: testRun.device },
    { name: t("review.attr.browser"), value: testRun.browser },
    { name: t("review.attr.viewport"), value: testRun.viewport },
    { name: t("review.attr.customTags"), value: testRun.customTags },
  ];

  return (
    <React.Fragment>
      {attributes
        .filter((attribute) => attribute.value)
        .map((attribute) => (
          <Grid item key={attribute.name}>
            <Tooltip title={attribute.name}>
              <Chip size="small" label={attribute.value} />
            </Tooltip>
          </Grid>
        ))}
      <Grid item>
        <DiffMeter
          diffPercent={testRun.diffPercent}
          tolerancePercent={testRun.diffTollerancePercent}
        />
      </Grid>
      {testRun.vlmDescription && (
        <Grid item xs={12}>
          <Tooltip title={t("review.vlmHelp")}>
            <Paper elevation={0} className={classes.vlmContainer}>
              <Typography variant="caption" className={classes.vlmLabel}>
                {t("review.vlm")}
              </Typography>
              <Typography variant="body2" className={classes.vlmDescription}>
                {testRun.vlmDescription}
              </Typography>
            </Paper>
          </Tooltip>
        </Grid>
      )}
    </React.Fragment>
  );
};
