import { FormControlLabel, Switch } from "@mui/material";
import React from "react";
import { TextValidator } from "react-material-ui-form-validator";
import { LooksSameConfig } from "../../types/imageComparison";
import { useConfigHook } from "./useConfigHook";
import { useT } from "../../i18n";
import { Explained } from "./OptionExplainer";

export const LooksSameConfigForm: React.FunctionComponent = () => {
  const [config, updateConfig] = useConfigHook<LooksSameConfig>();
  const { t } = useT();

  return (
    <React.Fragment>
      <FormControlLabel
        label={t("comparison.strict")}
        control={
          <Switch
            checked={config.strict}
            onChange={(event, checked) => updateConfig("strict", checked)}
            color="primary"
            name="strict"
          />
        }
      />
      <TextValidator
        name="tolerance"
        validators={["minNumber:0"]}
        errorMessages={[t("validation.greaterThan", { min: 0 })]}
        InputProps={{
          inputProps: {
            min: 0,
            step: 0.001,
          },
        }}
        margin="dense"
        id="tolerance"
        label={t("comparison.tolerance")}
        type="number"
        fullWidth
        helperText={t("comparison.toleranceHelp")}
        value={config.tolerance}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
          const { value } = event.target;
          updateConfig("tolerance", parseFloat(value));
        }}
      />
      <Explained option="antialiasing" on={!!config.ignoreAntialiasing}>
        <FormControlLabel
          label={t("comparison.ignoreAntialiasingLooksSame")}
          control={
            <Switch
              checked={config.ignoreAntialiasing}
              onChange={(event, checked) =>
                updateConfig("ignoreAntialiasing", checked)
              }
              color="primary"
              name="ignoreAntialiasing"
            />
          }
        />
      </Explained>
      <TextValidator
        name="antialiasingTolerance"
        validators={["minNumber:0"]}
        errorMessages={[t("validation.greaterThan", { min: 0 })]}
        InputProps={{
          inputProps: {
            min: 0,
            step: 0.001,
          },
        }}
        margin="dense"
        id="antialiasingTolerance"
        label={t("comparison.antialiasingTolerance")}
        type="number"
        fullWidth
        helperText={t("comparison.antialiasingToleranceHelp")}
        value={config.antialiasingTolerance}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
          const { value } = event.target;
          updateConfig("antialiasingTolerance", parseFloat(value));
        }}
      />
      <Explained option="caret" on={!!config.ignoreCaret}>
        <FormControlLabel
          label={t("comparison.ignoreCaret")}
          control={
            <Switch
              checked={config.ignoreCaret}
              onChange={(event, checked) =>
                updateConfig("ignoreCaret", checked)
              }
              color="primary"
              name="ignoreCaret"
            />
          }
        />
      </Explained>
      <Explained option="diffDimensions" on={!!config.allowDiffDimensions}>
        <FormControlLabel
          label={t("comparison.allowDiffDimensions")}
          control={
            <Switch
              checked={config.allowDiffDimensions}
              onChange={(event, checked) =>
                updateConfig("allowDiffDimensions", checked)
              }
              color="primary"
              name="diffDimensionsFeature"
            />
          }
        />
      </Explained>
    </React.Fragment>
  );
};
