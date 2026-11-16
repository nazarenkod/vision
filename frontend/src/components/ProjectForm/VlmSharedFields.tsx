import React from "react";
import { FormControlLabel, Switch } from "@mui/material";
import { TextValidator } from "react-material-ui-form-validator";
import { Tooltip } from "../Tooltip";
import { useT } from "../../i18n";

export const VlmPromptField: React.FunctionComponent<{
  value: string;
  onChange: (value: string) => void;
}> = ({ value, onChange }) => {
  const { t } = useT();
  return (
    <Tooltip title={t("comparison.promptHelp")}>
      <div>
        <TextValidator
          name="prompt"
          validators={["required"]}
          errorMessages={[t("comparison.promptRequired")]}
          margin="dense"
          id="prompt"
          label={t("comparison.prompt")}
          type="text"
          multiline
          rows={4}
          fullWidth
          required
          value={value}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            onChange(event.target.value);
          }}
        />
      </div>
    </Tooltip>
  );
};

export const VlmTemperatureField: React.FunctionComponent<{
  value: number;
  onChange: (value: number) => void;
}> = ({ value, onChange }) => {
  const { t } = useT();
  return (
    <Tooltip title={t("comparison.temperatureHelp")}>
      <div>
        <TextValidator
          name="temperature"
          validators={["minNumber:0", "maxNumber:1"]}
          errorMessages={[
            t("validation.atLeast", { min: 0 }),
            t("validation.atMost", { max: 1 }),
          ]}
          InputProps={{
            inputProps: {
              min: 0,
              max: 1,
              step: 0.01,
            },
          }}
          margin="dense"
          id="temperature"
          label={t("comparison.temperature")}
          helperText={t("comparison.temperatureShortHelp")}
          type="number"
          fullWidth
          required
          value={value}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            const { value: inputValue } = event.target;
            onChange(Number.parseFloat(inputValue));
          }}
        />
      </div>
    </Tooltip>
  );
};

export const VlmUseThinkingField: React.FunctionComponent<{
  value: boolean;
  onChange: (value: boolean) => void;
}> = ({ value, onChange }) => {
  const { t } = useT();
  return (
    <Tooltip title={t("comparison.useThinkingHelp")}>
      <FormControlLabel
        label={t("comparison.useThinking")}
        control={
          <Switch
            checked={value || false}
            onChange={(event, checked) => onChange(checked)}
            color="primary"
            name="useThinking"
          />
        }
      />
    </Tooltip>
  );
};
