import React from "react";
import {
  Box,
  Button,
  Chip,
  IconButton,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { Delete } from "@mui/icons-material";
import {
  setProjectEditState,
  useProjectDispatch,
  useProjectState,
} from "../../contexts";
import { AllowedBrowser } from "../../types";
import { projectsService } from "../../services";
import {
  AllowedBrowserProblem,
  allowedBrowsersOf,
  browserAllowed,
  invalidAllowedBrowser,
  sameBrowser,
  savedBrowser,
} from "../../_helpers/allowedBrowsers.helper";
import { MessageKey, useT } from "../../i18n";
import { DeviceTags } from "../DeviceTags";
import { tokens } from "../../theme";

const PROBLEM: Record<AllowedBrowserProblem, MessageKey> = {
  missing: "browsers.missing",
  wildcard: "browsers.wildcard",
  viewport: "browsers.badViewport",
};

const EMPTY: AllowedBrowser = { browser: "", version: "", viewport: "" };

/** One entry: a browser, its version and the window size, each edited in place. */
const BrowserFields: React.FunctionComponent<{
  value: AllowedBrowser;
  onChange: (value: AllowedBrowser) => void;
  error?: MessageKey;
  testId: string;
}> = ({ value, onChange, error, testId }) => {
  const { t } = useT();
  return (
    <>
      <TextField
        size="small"
        label={t("browsers.browser")}
        value={value.browser}
        onChange={(event) =>
          onChange({ ...value, browser: event.target.value })
        }
        inputProps={{ "data-testid": `${testId}-browser` }}
        error={!!error}
        helperText={error ? t(error) : " "}
        sx={{ flex: "1 1 140px" }}
      />
      <TextField
        size="small"
        label={t("browsers.version")}
        value={value.version}
        onChange={(event) =>
          onChange({ ...value, version: event.target.value })
        }
        inputProps={{ "data-testid": `${testId}-version` }}
        helperText={t("browsers.versionHint")}
        sx={{ flex: "1 1 140px" }}
      />
      <TextField
        size="small"
        label={t("browsers.viewport")}
        value={value.viewport}
        onChange={(event) =>
          onChange({ ...value, viewport: event.target.value })
        }
        inputProps={{ "data-testid": `${testId}-viewport` }}
        helperText={t("browsers.viewportHint")}
        sx={{ flex: "1 1 140px" }}
      />
    </>
  );
};

/**
 * The browsers web snapshots may come from (REQ-050-45): the list the team
 * agreed on, and the browsers snapshots already came from, each added in a
 * click (REQ-050-53).
 */
export const AllowedBrowsersSettings: React.FunctionComponent<{
  // a project of both platforms shows the devices above, under their own title
  title?: string;
}> = ({ title }) => {
  const { projectEditState: project } = useProjectState();
  const projectDispatch = useProjectDispatch();
  const { t } = useT();
  const browsers = allowedBrowsersOf(project.uiTreeSettings);
  const [draft, setDraft] = React.useState<AllowedBrowser>(EMPTY);
  const [received, setReceived] = React.useState<AllowedBrowser[]>([]);

  React.useEffect(() => {
    if (!project.id) return;
    let current = true;
    projectsService
      .getBrowsers(project.id)
      .then(
        (list) =>
          current &&
          setReceived(
            Array.isArray(list)
              ? list.map((entry) => ({
                  browser: entry.browser ?? "",
                  version: entry.version ?? "",
                  viewport: entry.viewport ?? "",
                }))
              : [],
          ),
      )
      // a suggestion only: without it the list is still edited by hand
      .catch(() => current && setReceived([]));
    return () => {
      current = false;
    };
  }, [project.id]);

  // only the list changes, the rest of the settings JSON stays as stored
  const save = (next: AllowedBrowser[]) => {
    let stored: Record<string, unknown> = {};
    try {
      stored = JSON.parse(project.uiTreeSettings || "{}") ?? {};
    } catch {
      stored = {};
    }
    setProjectEditState(projectDispatch, {
      ...project,
      uiTreeSettings: JSON.stringify({ ...stored, allowedBrowsers: next }),
    });
  };

  const add = (entry: AllowedBrowser) =>
    save([...browsers, savedBrowser(entry)]);

  const draftStarted = !!(
    draft.browser.trim() ||
    draft.version.trim() ||
    draft.viewport.trim()
  );
  const draftProblem = invalidAllowedBrowser(draft);
  const draftDuplicate = browsers.some((entry) => sameBrowser(entry, draft));
  const draftError: MessageKey | undefined = !draftStarted
    ? undefined
    : draftDuplicate
      ? "devices.duplicate"
      : draftProblem && draftProblem !== "missing"
        ? PROBLEM[draftProblem]
        : undefined;

  return (
    <Box
      sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}
      data-testid="allowedBrowsers"
    >
      {title && <Typography variant="subtitle1">{title}</Typography>}
      {browsers.length === 0 && (
        <Typography variant="body2" color="textSecondary">
          {t("browsers.none")}
        </Typography>
      )}
      {browsers.map((entry, index) => {
        const problem = invalidAllowedBrowser(entry);
        return (
          <Box
            key={index}
            data-testid={`allowedBrowser-${index}`}
            sx={{
              display: "flex",
              gap: 1.5,
              alignItems: "flex-start",
              flexWrap: "wrap",
            }}
          >
            <BrowserFields
              value={entry}
              testId={`allowedBrowser-${index}`}
              error={problem ? PROBLEM[problem] : undefined}
              onChange={(value) =>
                save(browsers.map((item, i) => (i === index ? value : item)))
              }
            />
            <Tooltip title={t("devices.remove")}>
              <IconButton
                aria-label={t("devices.remove")}
                data-testid={`allowedBrowser-${index}-remove`}
                onClick={() => save(browsers.filter((_, i) => i !== index))}
              >
                <Delete fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        );
      })}
      <Box
        sx={{
          display: "flex",
          gap: 1.5,
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        <BrowserFields
          value={draft}
          testId="newBrowser"
          error={draftError}
          onChange={setDraft}
        />
        <Button
          variant="outlined"
          data-testid="addBrowser"
          disabled={!!draftProblem || draftDuplicate}
          onClick={() => {
            add(draft);
            setDraft(EMPTY);
          }}
          sx={{ mt: 0.25 }}
        >
          {t("devices.add")}
        </Button>
      </Box>

      <Box sx={{ mt: 1 }} data-testid="receivedBrowsers">
        <Typography variant="subtitle2">{t("browsers.received")}</Typography>
        {!received.length && (
          <Typography variant="caption" color="textSecondary" component="div">
            {t("devices.receivedNone")}
          </Typography>
        )}
        {received.map((entry) => {
          const allowed = browserAllowed(
            browsers,
            entry.browser,
            entry.version,
            entry.viewport,
          );
          const key = [entry.browser, entry.version, entry.viewport]
            .filter(Boolean)
            .join(" / ");
          return (
            <Box
              key={key}
              data-testid={`receivedBrowser-${key}`}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                py: 0.5,
                borderTop: 1,
                borderColor: "divider",
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <DeviceTags
                  parts={{
                    browser: [entry.browser, entry.version]
                      .filter(Boolean)
                      .join(" "),
                    viewport: entry.viewport,
                  }}
                />
              </Box>
              {allowed ? (
                // text, not a grey chip: a chip would read as one more tag (REQ-037-06)
                <Typography
                  variant="body2"
                  sx={{
                    color: tokens.status.passed.fg,
                    fontWeight: 500,
                    px: 1,
                  }}
                >
                  {t("devices.allowed")}
                </Typography>
              ) : (
                <>
                  <Chip
                    size="small"
                    color="warning"
                    variant="outlined"
                    label={t("devices.notInList")}
                  />
                  <Button size="small" onClick={() => add(entry)}>
                    {t("devices.add")}
                  </Button>
                </>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};
