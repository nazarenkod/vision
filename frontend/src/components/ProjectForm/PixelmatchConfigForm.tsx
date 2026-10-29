import { FormControlLabel, Switch } from "@mui/material";
import React from "react";
import { TextValidator } from "react-material-ui-form-validator";
import { PixelmatchConfig } from "../../types/imageComparison";
import { Tooltip } from "../Tooltip";
import { useConfigHook } from "./useConfigHook";
import { useT } from "../../i18n";

export const PixelmatchConfigForm: React.FunctionComponent = () => {
  const [config, updateConfig] = useConfigHook<PixelmatchConfig>();
  const { t } = useT();

  return (
    <React.Fragment>
      <Tooltip title={t("comparison.allowDiffDimensionsHelp")}>
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
      </Tooltip>
      <Tooltip title={t("comparison.ignoreAntialiasingHelp")}>
        <FormControlLabel
          label={t("comparison.ignoreAntialiasing")}
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
      </Tooltip>
      <TextValidator
        name="threshold"
        validators={["minNumber:0", "maxNumber:1"]}
        errorMessages={[
          t("validation.greaterThan", { min: 0 }),
          t("validation.lessThan", { max: 1 }),
        ]}
        InputProps={{
          inputProps: {
            min: 0,
            max: 1,
            step: 0.001,
          },
        }}
        margin="dense"
        id="threshold"
        label={t("comparison.threshold")}
        helperText={t("comparison.thresholdHelp")}
        type="number"
        fullWidth
        required
        value={config.threshold}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
          const { value } = event.target;
          updateConfig("threshold", parseFloat(value));
        }}
      />
    </React.Fragment>
  );
};
