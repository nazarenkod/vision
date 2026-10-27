import React from "react";
import { MenuItem, Switch, TextField, Typography } from "@mui/material";
import { MessageKey, useT } from "../../i18n";
import { SettingRow, SettingSection } from "./SettingRow";
import { NumberField } from "./NumberField";
import { PROJECT_DEFAULTS } from "./defaults";
import { useFieldError, useProjectDraft } from "./useProjectDraft";

export const GROUP_BY_AXES: Array<[string, MessageKey, MessageKey]> = [
  ["customTags", "general.axis.customTags", "general.axis.customTagsHelp"],
  ["os", "general.axis.os", "general.axis.osHelp"],
  ["device", "general.axis.device", "general.axis.deviceHelp"],
  ["viewport", "general.axis.viewport", "general.axis.viewportHelp"],
  ["browser", "general.axis.browser", "general.axis.browserHelp"],
];

export const GeneralTab: React.FunctionComponent = () => {
  const { t } = useT();
  const { project, update } = useProjectDraft();
  const onOff = (value: boolean) => t(value ? "settings.on" : "settings.off");
  const axisLabel = (axis: string) => {
    const known = GROUP_BY_AXES.find(([value]) => value === axis);
    return known ? t(known[1]) : axis;
  };

  return (
    <>
      <SettingSection title={t("general.project")}>
        <SettingRow label={t("general.name")} wide>
          <TextField
            id="name"
            size="small"
            fullWidth
            required
            inputProps={{ "aria-label": t("general.name") }}
            value={project.name}
            error={!!useFieldError("name")}
            helperText={useFieldError("name")}
            onChange={(event) => update({ name: event.target.value })}
          />
        </SettingRow>
        <SettingRow
          label={t("general.mainBranch")}
          help={t("general.mainBranchHelp")}
          wide
        >
          <TextField
            id="branchName"
            size="small"
            fullWidth
            required
            inputProps={{ "aria-label": t("general.mainBranch") }}
            value={project.mainBranchName}
            error={!!useFieldError("branchName")}
            helperText={useFieldError("branchName")}
            onChange={(event) => update({ mainBranchName: event.target.value })}
          />
        </SettingRow>
      </SettingSection>

      <SettingSection
        title={t("general.review")}
        intro={t("general.reviewIntro")}
      >
        <SettingRow
          label={t("general.autoApprove")}
          help={t("general.autoApproveHelp")}
          defaultText={onOff(PROJECT_DEFAULTS.autoApproveFeature)}
          changed={
            project.autoApproveFeature !== PROJECT_DEFAULTS.autoApproveFeature
          }
          onReset={() =>
            update({ autoApproveFeature: PROJECT_DEFAULTS.autoApproveFeature })
          }
        >
          <Switch
            name="autoApproveFeature"
            inputProps={{ "aria-label": t("general.autoApprove") }}
            checked={project.autoApproveFeature}
            onChange={(_, checked) => update({ autoApproveFeature: checked })}
          />
        </SettingRow>
        <SettingRow
          label={t("general.groupBy")}
          help={
            <>
              {t("general.groupByHelp")}
              <Typography variant="body2" component="span" display="block">
                {t(
                  GROUP_BY_AXES.find(
                    ([value]) => value === project.bulkApproveGroupBy,
                  )?.[2] ?? "general.axis.customTagsHelp",
                )}
              </Typography>
            </>
          }
          defaultText={axisLabel(PROJECT_DEFAULTS.bulkApproveGroupBy)}
          changed={
            project.bulkApproveGroupBy !== PROJECT_DEFAULTS.bulkApproveGroupBy
          }
          onReset={() =>
            update({ bulkApproveGroupBy: PROJECT_DEFAULTS.bulkApproveGroupBy })
          }
        >
          <TextField
            id="bulkApproveGroupBy"
            select
            size="small"
            sx={{ minWidth: 220 }}
            inputProps={{ "aria-label": t("general.groupBy") }}
            value={project.bulkApproveGroupBy}
            onChange={(event) =>
              update({ bulkApproveGroupBy: event.target.value })
            }
          >
            {GROUP_BY_AXES.map(([value, label]) => (
              <MenuItem key={value} value={value}>
                {t(label)}
              </MenuItem>
            ))}
          </TextField>
        </SettingRow>
        <SettingRow
          label={t("general.bulkApprove")}
          help={t("general.bulkApproveHelp")}
          defaultText={onOff(PROJECT_DEFAULTS.bulkApproveVariations)}
          changed={
            project.bulkApproveVariations !==
            PROJECT_DEFAULTS.bulkApproveVariations
          }
          onReset={() =>
            update({
              bulkApproveVariations: PROJECT_DEFAULTS.bulkApproveVariations,
            })
          }
        >
          <Switch
            name="bulkApproveVariations"
            inputProps={{ "aria-label": t("general.bulkApprove") }}
            checked={project.bulkApproveVariations}
            onChange={(_, checked) =>
              update({ bulkApproveVariations: checked })
            }
          />
        </SettingRow>
      </SettingSection>

      <SettingSection
        title={t("general.cleanup")}
        intro={t("general.cleanupIntro")}
      >
        <SettingRow
          label={t("general.buildCount")}
          help={t("general.buildCountHelp")}
          defaultText={`${PROJECT_DEFAULTS.maxBuildAllowed}`}
          changed={project.maxBuildAllowed !== PROJECT_DEFAULTS.maxBuildAllowed}
          onReset={() =>
            update({ maxBuildAllowed: PROJECT_DEFAULTS.maxBuildAllowed })
          }
        >
          <NumberField
            id="buildCount"
            sx={{ width: 140 }}
            inputProps={{ "aria-label": t("general.buildCount") }}
            value={project.maxBuildAllowed}
            error={!!useFieldError("buildCount")}
            helperText={useFieldError("buildCount")}
            onChange={(value) => update({ maxBuildAllowed: value ?? NaN })}
          />
        </SettingRow>
        <SettingRow
          label={t("general.branchLifetime")}
          help={t("general.branchLifetimeHelp", {
            branch: project.mainBranchName || "main",
          })}
          defaultText={t("general.days", {
            count: PROJECT_DEFAULTS.maxBranchLifetime,
          })}
          changed={
            project.maxBranchLifetime !== PROJECT_DEFAULTS.maxBranchLifetime
          }
          onReset={() =>
            update({ maxBranchLifetime: PROJECT_DEFAULTS.maxBranchLifetime })
          }
        >
          <NumberField
            id="maxBranchLifetime"
            sx={{ width: 140 }}
            inputProps={{ "aria-label": t("general.branchLifetime") }}
            value={project.maxBranchLifetime}
            error={!!useFieldError("maxBranchLifetime")}
            helperText={useFieldError("maxBranchLifetime")}
            onChange={(value) => update({ maxBranchLifetime: value ?? NaN })}
          />
        </SettingRow>
      </SettingSection>
    </>
  );
};
