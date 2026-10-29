import React from "react";
import { Box, Divider, TextField, Typography } from "@mui/material";
import {
  setProjectEditState,
  useProjectDispatch,
  useProjectState,
} from "../../contexts";
import { parseUiTreeSettings } from "../../types/insights";
import { useT } from "../../i18n";

/**
 * How accessibility issues become problems, so one bug covers one problem:
 * where the screen title is. What is one problem is the same for every
 * project (021), so it is only explained here.
 */
export const A11yProblemSettings: React.FunctionComponent<{
  // on the settings page the section card carries the heading
  bare?: boolean;
}> = ({ bare = false }) => {
  const { projectEditState: project } = useProjectState();
  const projectDispatch = useProjectDispatch();
  const { t } = useT();
  const settings = parseUiTreeSettings(project.uiTreeSettings);
  const [titleText, setTitleText] = React.useState(
    (settings.screenTitle ?? ["id:Appbar#Title"]).join("\n"),
  );

  return (
    <Box
      sx={{
        mt: bare ? 0 : 3,
        display: "flex",
        flexDirection: "column",
        gap: 1,
      }}
      data-testid="a11yProblemSettings"
    >
      {!bare && <Divider />}
      {!bare && <Typography variant="subtitle1">{t("a11y.title")}</Typography>}
      {!bare && (
        <Typography variant="body2" color="textSecondary">
          {t("a11y.intro")}
        </Typography>
      )}

      <TextField
        id="screenTitleSelectors"
        size="small"
        multiline
        minRows={2}
        label={t("a11y.screenTitle")}
        value={titleText}
        onChange={(event) => setTitleText(event.target.value)}
        onBlur={() => {
          const selectors = titleText
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean);
          setProjectEditState(projectDispatch, {
            ...project,
            uiTreeSettings: JSON.stringify({
              ...settings,
              screenTitle: selectors.length ? selectors : ["id:Appbar#Title"],
            }),
          });
        }}
        helperText={t("a11y.screenTitleHelp")}
        sx={{ maxWidth: 520 }}
      />

      <Typography
        variant="caption"
        color="textSecondary"
        data-testid="a11yGrouping"
        sx={{ maxWidth: 640 }}
      >
        {t("a11y.grouping")}
      </Typography>
    </Box>
  );
};
