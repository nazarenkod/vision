import { SecretField } from "./SecretField";
import { useProjectState } from "../../contexts";
import React from "react";
import { Link } from "@mui/material";
import { TextValidator } from "react-material-ui-form-validator";
import { GeminiVlmConfig } from "../../types/imageComparison";
import { Tooltip } from "../Tooltip";
import { useConfigHook } from "./useConfigHook";
import {
  VlmPromptField,
  VlmTemperatureField,
  VlmUseThinkingField,
} from "./VlmSharedFields";
import { useT } from "../../i18n";

export const GeminiConfigForm: React.FunctionComponent = () => {
  const [config, updateConfig] = useConfigHook<GeminiVlmConfig>();
  const { t } = useT();
  const { projectEditState } = useProjectState();
  // the edit state is the project as loaded: the flag rides along with it
  const keySaved = !!(projectEditState as { geminiApiKeySet?: boolean })
    .geminiApiKeySet;

  return (
    <React.Fragment>
      <Tooltip title={t("comparison.geminiModelHelp")}>
        <div>
          <TextValidator
            name="model"
            validators={["required"]}
            errorMessages={[t("comparison.modelRequired")]}
            margin="dense"
            id="model"
            label={t("comparison.geminiModel")}
            type="text"
            fullWidth
            required
            value={config.model || ""}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
              updateConfig("model", event.target.value);
            }}
            helperText={
              <span>
                {t("comparison.geminiModelName")}{" "}
                <Link
                  href="https://ai.google.dev/models/gemini"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  {t("comparison.geminiModels")}
                </Link>
              </span>
            }
          />
        </div>
      </Tooltip>
      {keySaved ? (
        // the key never comes back from the server: only that one is saved
        <SecretField
          id="apiKey"
          label={t("comparison.geminiKey")}
          saved
          value={config.apiKey}
          onChange={(apiKey) => updateConfig("apiKey", apiKey)}
        />
      ) : (
        <Tooltip title={t("comparison.geminiKeyHelp")}>
          <div>
            <TextValidator
              name="apiKey"
              validators={["required"]}
              errorMessages={[t("comparison.geminiKeyRequired")]}
              margin="dense"
              id="apiKey"
              label={t("comparison.geminiKeyNew")}
              type="password"
              fullWidth
              required
              value={config.apiKey || ""}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                updateConfig("apiKey", event.target.value);
              }}
              helperText={t("comparison.geminiKeyEnter")}
            />
          </div>
        </Tooltip>
      )}
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
