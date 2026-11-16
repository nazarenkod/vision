import { FormControlLabel, Switch } from "@mui/material";
import React from "react";
import { TextValidator } from "react-material-ui-form-validator";
import { OdiffConfig } from "../../types/imageComparison";
import { useConfigHook } from "./useConfigHook";
import { useT } from "../../i18n";

export const OdiffConfigForm: React.FunctionComponent = () => {
  const [config, updateConfig] = useConfigHook<OdiffConfig>();
  const { t } = useT();

  return (
    <React.Fragment>
      <FormControlLabel
        label={t("comparison.outputDiffMask")}
        control={
          <Switch
            checked={config.outputDiffMask}
            onChange={(event, checked) =>
              updateConfig("outputDiffMask", checked)
            }
            color="primary"
            name="strict"
          />
        }
      />
      <FormControlLabel
        label={t("comparison.failOnLayoutDiff")}
        control={
          <Switch
            checked={config.failOnLayoutDiff}
            onChange={(event, checked) =>
              updateConfig("failOnLayoutDiff", checked)
            }
            color="primary"
            name="strict"
          />
        }
      />
      <FormControlLabel
        label={t("comparison.ignoreAntialiasingLooksSame")}
        control={
          <Switch
            checked={config.antialiasing}
            onChange={(event, checked) => updateConfig("antialiasing", checked)}
            color="primary"
            name="antialiasing"
          />
        }
      />
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
