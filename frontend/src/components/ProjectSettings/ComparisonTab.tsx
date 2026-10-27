import React from "react";
import {
  Box,
  Chip,
  FormControlLabel,
  LinearProgress,
  Link,
  MenuItem,
  Radio,
  RadioGroup,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { useSnackbar } from "notistack";
import { MessageKey, useT } from "../../i18n";
import {
  GeminiVlmConfig,
  ImageComparison,
  LooksSameConfig,
  OdiffConfig,
  OllamaVlmConfig,
  PixelmatchConfig,
  VlmConfig,
} from "../../types/imageComparison";
import { OllamaModel } from "../../types";
import { ollamaService } from "../../services";
import { tokens } from "../../theme";
import { SettingRow, SettingSection } from "./SettingRow";
import { NumberField } from "./NumberField";
import { useConfigHook } from "./useConfigHook";
import { getDefaultConfig } from "./utils";
import { useFieldError, useProjectDraft } from "./useProjectDraft";

const LIBRARIES: Array<[ImageComparison, MessageKey, MessageKey]> = [
  [
    ImageComparison.pixelmatch,
    "comparison.pixelmatch",
    "comparison.pixelmatchHelp",
  ],
  [ImageComparison.lookSame, "comparison.lookSame", "comparison.lookSameHelp"],
  [ImageComparison.odiff, "comparison.odiff", "comparison.odiffHelp"],
  [ImageComparison.vlm, "comparison.vlm", "comparison.vlmHelp"],
];

// a value the library's defaults have, for the chip and the reset
const defaultOf = <T,>(library: ImageComparison, key: keyof T) =>
  (JSON.parse(getDefaultConfig(library)) as T)[key];

export const ComparisonTab: React.FunctionComponent = () => {
  const { t } = useT();
  const { project, update } = useProjectDraft();

  return (
    <>
      <SettingSection
        title={t("comparison.library")}
        intro={t("comparison.libraryIntro")}
      >
        <RadioGroup
          aria-label={t("comparison.library")}
          value={project.imageComparison}
          onChange={(event) => {
            const imageComparison = event.target.value as ImageComparison;
            if (imageComparison === project.imageComparison) return;
            // each library reads its own options: the old ones mean nothing to the new one
            if (!window.confirm(t("comparison.switchConfirm"))) return;
            update({
              imageComparison,
              imageComparisonConfig: getDefaultConfig(imageComparison),
            });
          }}
          sx={{ display: "grid", gap: 1, py: 1.5 }}
        >
          {LIBRARIES.map(([value, label, help]) => (
            <Box
              key={value}
              sx={{
                border: `1px solid ${
                  project.imageComparison === value
                    ? tokens.brand
                    : tokens.border
                }`,
                borderRadius: 2,
                px: 1.5,
                py: 1,
              }}
            >
              <FormControlLabel
                value={value}
                control={<Radio size="small" />}
                sx={{ alignItems: "flex-start", m: 0, width: "100%" }}
                label={
                  <Box sx={{ pt: 0.75 }}>
                    <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                      <Typography sx={{ fontWeight: 500 }}>
                        {t(label)}
                      </Typography>
                      {value === ImageComparison.pixelmatch && (
                        <Chip
                          size="small"
                          color="primary"
                          variant="outlined"
                          label={t("settings.recommended")}
                          sx={{ height: 20, fontSize: 11 }}
                        />
                      )}
                    </Box>
                    <Typography variant="body2" color="textSecondary">
                      {t(help)}
                    </Typography>
                  </Box>
                }
              />
            </Box>
          ))}
        </RadioGroup>
      </SettingSection>
      <SettingSection title={t("comparison.options")}>
        {project.imageComparison === ImageComparison.pixelmatch && (
          <PixelmatchOptions />
        )}
        {project.imageComparison === ImageComparison.lookSame && (
          <LooksSameOptions />
        )}
        {project.imageComparison === ImageComparison.odiff && <OdiffOptions />}
        {project.imageComparison === ImageComparison.vlm && <VlmOptions />}
      </SettingSection>
    </>
  );
};

/** A yes/no option of the library, with its default. */
function BooleanOption<T>({
  library,
  name,
  label,
  help,
  config,
  updateConfig,
}: {
  library: ImageComparison;
  name: keyof T;
  label: string;
  help: string;
  config: T;
  updateConfig: (name: keyof T, value: T[keyof T]) => void;
}) {
  const { t } = useT();
  const fallback = !!defaultOf<T>(library, name);
  const value = config[name] === undefined ? fallback : !!config[name];
  return (
    <SettingRow
      label={label}
      help={help}
      defaultText={t(fallback ? "settings.on" : "settings.off")}
      changed={value !== fallback}
      onReset={() => updateConfig(name, fallback as T[keyof T])}
    >
      <Switch
        name={String(name)}
        inputProps={{ "aria-label": label }}
        checked={value}
        onChange={(_, checked) => updateConfig(name, checked as T[keyof T])}
      />
    </SettingRow>
  );
}

/** A number option of the library, with its default. */
function NumberOption<T>({
  library,
  name,
  id,
  label,
  help,
  config,
  updateConfig,
}: {
  library: ImageComparison;
  name: keyof T;
  id: string;
  label: string;
  help: string;
  config: T;
  updateConfig: (name: keyof T, value: T[keyof T]) => void;
}) {
  const { formatNumber } = useT();
  const error = useFieldError(id);
  const fallback = defaultOf<T>(library, name) as unknown as number;
  const value = config[name] as unknown as number | undefined;
  return (
    <SettingRow
      label={label}
      help={help}
      defaultText={formatNumber(fallback)}
      changed={value !== undefined && value !== fallback}
      onReset={() => updateConfig(name, fallback as T[keyof T])}
    >
      <NumberField
        id={id}
        sx={{ width: 140 }}
        inputProps={{ "aria-label": label }}
        value={value ?? fallback}
        error={!!error}
        helperText={error}
        onChange={(next) => updateConfig(name, (next ?? NaN) as T[keyof T])}
      />
    </SettingRow>
  );
}

const PixelmatchOptions = () => {
  const { t } = useT();
  const [config, updateConfig] = useConfigHook<PixelmatchConfig>();
  const props = {
    library: ImageComparison.pixelmatch,
    config,
    updateConfig,
  };
  return (
    <>
      <NumberOption
        {...props}
        name="threshold"
        id="threshold"
        label={t("comparison.threshold")}
        help={t("comparison.thresholdHelp")}
      />
      <BooleanOption
        {...props}
        name="ignoreAntialiasing"
        label={t("comparison.ignoreAntialiasing")}
        help={t("comparison.ignoreAntialiasingHelp")}
      />
      <BooleanOption
        {...props}
        name="allowDiffDimensions"
        label={t("comparison.allowDiffDimensions")}
        help={t("comparison.allowDiffDimensionsHelp")}
      />
    </>
  );
};

const LooksSameOptions = () => {
  const { t } = useT();
  const [config, updateConfig] = useConfigHook<LooksSameConfig>();
  const props = { library: ImageComparison.lookSame, config, updateConfig };
  return (
    <>
      <BooleanOption
        {...props}
        name="strict"
        label={t("comparison.strict")}
        help={t("comparison.strictHelp")}
      />
      {!config.strict && (
        <NumberOption
          {...props}
          name="tolerance"
          id="tolerance"
          label={t("comparison.tolerance")}
          help={t("comparison.toleranceHelp")}
        />
      )}
      <BooleanOption
        {...props}
        name="ignoreAntialiasing"
        label={t("comparison.ignoreAntialiasing")}
        help={t("comparison.ignoreAntialiasingHelp")}
      />
      {config.ignoreAntialiasing !== false && (
        <NumberOption
          {...props}
          name="antialiasingTolerance"
          id="antialiasingTolerance"
          label={t("comparison.antialiasingTolerance")}
          help={t("comparison.antialiasingToleranceHelp")}
        />
      )}
      <BooleanOption
        {...props}
        name="ignoreCaret"
        label={t("comparison.ignoreCaret")}
        help={t("comparison.ignoreCaretHelp")}
      />
      <BooleanOption
        {...props}
        name="allowDiffDimensions"
        label={t("comparison.allowDiffDimensions")}
        help={t("comparison.allowDiffDimensionsHelp")}
      />
    </>
  );
};

const OdiffOptions = () => {
  const { t } = useT();
  const [config, updateConfig] = useConfigHook<OdiffConfig>();
  const props = { library: ImageComparison.odiff, config, updateConfig };
  return (
    <>
      <NumberOption
        {...props}
        name="threshold"
        id="threshold"
        label={t("comparison.threshold")}
        help={t("comparison.odiffThresholdHelp")}
      />
      <BooleanOption
        {...props}
        name="antialiasing"
        label={t("comparison.ignoreAntialiasing")}
        help={t("comparison.ignoreAntialiasingHelp")}
      />
      <BooleanOption
        {...props}
        name="failOnLayoutDiff"
        label={t("comparison.failOnLayoutDiff")}
        help={t("comparison.failOnLayoutDiffHelp")}
      />
      <BooleanOption
        {...props}
        name="outputDiffMask"
        label={t("comparison.outputDiffMask")}
        help={t("comparison.outputDiffMaskHelp")}
      />
    </>
  );
};

const VlmOptions = () => {
  const { t } = useT();
  const [config, updateConfig] = useConfigHook<VlmConfig>();
  const { update } = useProjectDraft();
  const provider = config.provider === "gemini" ? "gemini" : "ollama";
  const temperatureError = useFieldError("temperature");
  const promptError = useFieldError("prompt");
  const fallback = JSON.parse(
    getDefaultConfig(ImageComparison.vlm),
  ) as OllamaVlmConfig;

  return (
    <>
      <SettingRow
        label={t("comparison.provider")}
        help={t("comparison.providerHelp")}
      >
        <TextField
          id="provider"
          select
          size="small"
          sx={{ minWidth: 200 }}
          inputProps={{ "aria-label": t("comparison.provider") }}
          value={provider}
          onChange={(event) => {
            const shared = {
              prompt: config.prompt,
              temperature: config.temperature,
              useThinking: config.useThinking,
            };
            const next: VlmConfig =
              event.target.value === "gemini"
                ? {
                    provider: "gemini",
                    model: "gemini-1.5-pro",
                    apiKey: "",
                    ...shared,
                  }
                : { provider: "ollama", model: "", ...shared };
            update({ imageComparisonConfig: JSON.stringify(next) });
          }}
        >
          <MenuItem value="ollama">Ollama</MenuItem>
          <MenuItem value="gemini">Google Gemini</MenuItem>
        </TextField>
      </SettingRow>
      {provider === "gemini" ? <GeminiFields /> : <OllamaModelField />}
      <SettingRow
        label={t("comparison.prompt")}
        help={t("comparison.promptHelp")}
        changed={config.prompt !== fallback.prompt}
        onReset={() => updateConfig("prompt", fallback.prompt)}
        wide
      >
        <TextField
          id="prompt"
          multiline
          minRows={4}
          fullWidth
          size="small"
          inputProps={{ "aria-label": t("comparison.prompt") }}
          value={config.prompt ?? ""}
          error={!!promptError}
          helperText={promptError}
          onChange={(event) => updateConfig("prompt", event.target.value)}
        />
      </SettingRow>
      <SettingRow
        label={t("comparison.temperature")}
        help={t("comparison.temperatureHelp")}
        defaultText={`${fallback.temperature}`}
        changed={config.temperature !== fallback.temperature}
        onReset={() => updateConfig("temperature", fallback.temperature)}
      >
        <NumberField
          id="temperature"
          sx={{ width: 140 }}
          inputProps={{ "aria-label": t("comparison.temperature") }}
          value={config.temperature}
          error={!!temperatureError}
          helperText={temperatureError}
          onChange={(value) => updateConfig("temperature", value ?? NaN)}
        />
      </SettingRow>
      <SettingRow
        label={t("comparison.useThinking")}
        help={t("comparison.useThinkingHelp")}
        defaultText={t("settings.off")}
        changed={!!config.useThinking}
        onReset={() => updateConfig("useThinking", false)}
      >
        <Switch
          name="useThinking"
          inputProps={{ "aria-label": t("comparison.useThinking") }}
          checked={!!config.useThinking}
          onChange={(_, checked) => updateConfig("useThinking", checked)}
        />
      </SettingRow>
    </>
  );
};

const GeminiFields = () => {
  const { t } = useT();
  const [config, updateConfig] = useConfigHook<GeminiVlmConfig>();
  const modelError = useFieldError("model");
  const keyError = useFieldError("apiKey");
  return (
    <>
      <SettingRow
        label={t("comparison.model")}
        help={
          <>
            {t("comparison.geminiModelHelp")}{" "}
            <Link
              href="https://ai.google.dev/models/gemini"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("comparison.geminiModels")}
            </Link>
          </>
        }
      >
        <TextField
          id="model"
          size="small"
          sx={{ minWidth: 220 }}
          inputProps={{ "aria-label": t("comparison.model") }}
          value={config.model ?? ""}
          error={!!modelError}
          helperText={modelError}
          onChange={(event) => updateConfig("model", event.target.value)}
        />
      </SettingRow>
      <SettingRow
        label={t("comparison.apiKey")}
        help={t("comparison.apiKeyHelp")}
      >
        <TextField
          id="apiKey"
          type="password"
          size="small"
          autoComplete="new-password"
          sx={{ minWidth: 220 }}
          inputProps={{ "aria-label": t("comparison.apiKey") }}
          value={config.apiKey ?? ""}
          error={!!keyError}
          helperText={keyError}
          onChange={(event) => updateConfig("apiKey", event.target.value)}
        />
      </SettingRow>
    </>
  );
};

const OllamaModelField = () => {
  const { t } = useT();
  const { enqueueSnackbar } = useSnackbar();
  const [config, updateConfig] = useConfigHook<OllamaVlmConfig>();
  const [models, setModels] = React.useState<OllamaModel[]>([]);
  const [loading, setLoading] = React.useState(true);
  const error = useFieldError("model");

  React.useEffect(() => {
    let mounted = true;
    ollamaService
      .listModels()
      .then((list) => mounted && setModels(list))
      .catch((err) => mounted && enqueueSnackbar(err, { variant: "error" }))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [enqueueSnackbar]);

  const unknown =
    !!config.model &&
    models.length > 0 &&
    !models.some((model) => model.name === config.model);

  return (
    <SettingRow
      label={t("comparison.model")}
      help={
        models.length || loading
          ? t("comparison.ollamaModelHelp")
          : t("comparison.ollamaNoModels")
      }
    >
      {models.length ? (
        <TextField
          id="model"
          select
          size="small"
          sx={{ minWidth: 220 }}
          inputProps={{ "aria-label": t("comparison.model") }}
          value={config.model ?? ""}
          error={!!error || unknown}
          helperText={error ?? (unknown ? t("comparison.unknownModel") : "")}
          onChange={(event) => updateConfig("model", event.target.value)}
        >
          {models.map((model) => (
            <MenuItem key={model.name} value={model.name}>
              {model.name}
            </MenuItem>
          ))}
        </TextField>
      ) : (
        <TextField
          id="model"
          size="small"
          sx={{ minWidth: 220 }}
          disabled={loading}
          inputProps={{ "aria-label": t("comparison.model") }}
          value={config.model ?? ""}
          error={!!error}
          helperText={error}
          onChange={(event) => updateConfig("model", event.target.value)}
        />
      )}
      {loading && <LinearProgress sx={{ mt: 0.5 }} />}
    </SettingRow>
  );
};
