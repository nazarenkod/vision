import React from "react";
import { Box, Button, TextField } from "@mui/material";
import { useT } from "../../i18n";
import { SettingRow, SettingSection } from "./SettingRow";
import { useFieldError, useProjectDraft } from "./useProjectDraft";

/** Jira connection used to file accessibility bugs from the review screen. */
export const JiraTab: React.FunctionComponent = () => {
  const { t } = useT();
  const { project, update } = useProjectDraft();
  // the API never returns the token, only whether one is saved
  const tokenSaved = !!(project as { jiraTokenSet?: boolean }).jiraTokenSet;
  const urlError = useFieldError("jiraUrl");

  return (
    <SettingSection title={t("jira.title")} intro={t("jira.intro")}>
      <SettingRow label={t("jira.url")} help={t("jira.urlHelp")} wide>
        <TextField
          id="jiraUrl"
          size="small"
          fullWidth
          placeholder="https://jira.example.com"
          inputProps={{ "aria-label": t("jira.url") }}
          value={project.jiraUrl ?? ""}
          error={!!urlError}
          helperText={urlError}
          onChange={(event) => update({ jiraUrl: event.target.value })}
        />
      </SettingRow>
      <SettingRow label={t("jira.token")} help={t("jira.tokenHelp")} wide>
        <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
          <TextField
            id="jiraToken"
            type="password"
            size="small"
            fullWidth
            autoComplete="new-password"
            inputProps={{ "aria-label": t("jira.token") }}
            placeholder={tokenSaved ? t("jira.tokenSaved") : ""}
            value={project.jiraToken ?? ""}
            onChange={(event) =>
              update({ jiraToken: event.target.value || undefined })
            }
            helperText={
              tokenSaved && project.jiraToken === ""
                ? t("jira.tokenWillBeRemoved")
                : undefined
            }
          />
          {tokenSaved && project.jiraToken === undefined && (
            <Button
              size="small"
              sx={{ whiteSpace: "nowrap", mt: 0.5 }}
              onClick={() => update({ jiraToken: "" })}
            >
              {t("jira.removeToken")}
            </Button>
          )}
        </Box>
      </SettingRow>
      <SettingRow label={t("jira.email")} help={t("jira.emailHelp")} wide>
        <TextField
          id="jiraEmail"
          size="small"
          fullWidth
          inputProps={{ "aria-label": t("jira.email") }}
          value={project.jiraEmail ?? ""}
          onChange={(event) => update({ jiraEmail: event.target.value })}
        />
      </SettingRow>
      <SettingRow
        label={t("jira.issueType")}
        help={t("jira.issueTypeHelp")}
        defaultText="Bug"
      >
        <TextField
          id="jiraIssueType"
          size="small"
          placeholder="Bug"
          sx={{ width: 200 }}
          inputProps={{ "aria-label": t("jira.issueType") }}
          value={project.jiraIssueType ?? ""}
          onChange={(event) => update({ jiraIssueType: event.target.value })}
        />
      </SettingRow>
      <SettingRow
        label={t("jira.linkType")}
        help={t("jira.linkTypeHelp")}
        defaultText="Relates"
      >
        <TextField
          id="jiraLinkType"
          size="small"
          placeholder="Relates"
          sx={{ width: 200 }}
          inputProps={{ "aria-label": t("jira.linkType") }}
          value={project.jiraLinkType ?? ""}
          onChange={(event) => update({ jiraLinkType: event.target.value })}
        />
      </SettingRow>
    </SettingSection>
  );
};
