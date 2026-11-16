import React, { useState, useEffect, useMemo } from "react";
import {
  LinearProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  SelectChangeEvent,
} from "@mui/material";
import { TextValidator } from "react-material-ui-form-validator";
import { useSnackbar } from "notistack";
import { OllamaVlmConfig } from "../../types/imageComparison";
import { Tooltip } from "../Tooltip";
import { useConfigHook } from "./useConfigHook";
import { ollamaService } from "../../services";
import { OllamaModel } from "../../types";
import {
  VlmPromptField,
  VlmTemperatureField,
  VlmUseThinkingField,
} from "./VlmSharedFields";
import { useT } from "../../i18n";

export const OllamaConfigForm: React.FunctionComponent = () => {
  const { enqueueSnackbar } = useSnackbar();
  const [config, updateConfig] = useConfigHook<OllamaVlmConfig>();
  const { t } = useT();
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    ollamaService
      .listModels()
      .then((fetchedModels) => {
        if (isMounted) {
          setModels(fetchedModels);
        }
      })
      .catch((err) => {
        if (isMounted) {
          enqueueSnackbar(err, {
            variant: "error",
          });
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, [enqueueSnackbar]);

  const hasError = useMemo(() => {
    if (!config.model || loading || models.length === 0) {
      return false;
    }
    return !models.some((m) => m.name === config.model);
  }, [config.model, models, loading]);

  const handleModelChange = (event: SelectChangeEvent<string>) => {
    updateConfig("model", event.target.value);
  };

  const renderModelField = () => {
    if (loading) {
      return (
        <TextValidator
          name="model"
          validators={["required"]}
          errorMessages={[t("comparison.modelRequired")]}
          margin="dense"
          id="model"
          label={t("comparison.model")}
          type="text"
          fullWidth
          required
          value={config.model || ""}
          disabled
          helperText={t("comparison.loadingModels")}
        />
      );
    }

    if (models.length === 0) {
      return (
        <TextValidator
          name="model"
          validators={["required"]}
          errorMessages={[t("comparison.modelRequired")]}
          margin="dense"
          id="model"
          label={t("comparison.model")}
          type="text"
          fullWidth
          required
          value={config.model || ""}
          helperText={t("comparison.noModels")}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            updateConfig("model", event.target.value);
          }}
        />
      );
    }

    return (
      <FormControl
        variant="standard"
        fullWidth
        margin="dense"
        error={hasError}
        required
      >
        <InputLabel id="model-select-label">{t("comparison.model")}</InputLabel>
        <Select
          labelId="model-select-label"
          id="model-select"
          value={config.model || ""}
          onChange={handleModelChange}
          name="model"
        >
          {models.map((model) => (
            <MenuItem key={model.name} value={model.name}>
              {model.name}
            </MenuItem>
          ))}
        </Select>
        {hasError && (
          <FormHelperText>{t("comparison.unknownModel")}</FormHelperText>
        )}
      </FormControl>
    );
  };

  return (
    <React.Fragment>
      <Tooltip title={t("comparison.ollamaModelHelp")}>
        <div>
          {renderModelField()}
          <TextValidator
            name="model"
            validators={["required"]}
            errorMessages={[t("comparison.modelRequired")]}
            value={config.model || ""}
            style={{ display: "none" }}
          />
        </div>
      </Tooltip>
      {loading && <LinearProgress />}
      <VlmPromptField
        value={config.prompt}
        onChange={(value) => updateConfig("prompt", value)}
      />
      <VlmTemperatureField
        value={config.temperature}
        onChange={(value) => updateConfig("temperature", value)}
      />
      <VlmUseThinkingField
        value={config.useThinking || false}
        onChange={(value) => updateConfig("useThinking", value)}
      />
    </React.Fragment>
  );
};
