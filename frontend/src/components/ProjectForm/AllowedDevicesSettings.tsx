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
import { AllowedDevice } from "../../types";
import { projectsService } from "../../services";
import {
  allowedDevicesOf,
  deviceAllowed,
  invalidAllowedDevice,
  sameDevice,
} from "../../_helpers/allowedDevices.helper";
import { MessageKey, useT } from "../../i18n";

const PROBLEM: Record<"missing" | "wildcard", MessageKey> = {
  missing: "devices.missing",
  wildcard: "devices.wildcard",
};

const EMPTY: AllowedDevice = { device: "", os: "" };

/** One entry: a device and an OS version, each edited in place. */
const DeviceFields: React.FunctionComponent<{
  value: AllowedDevice;
  onChange: (value: AllowedDevice) => void;
  error?: MessageKey;
  testId: string;
}> = ({ value, onChange, error, testId }) => {
  const { t } = useT();
  return (
    <>
      <TextField
        size="small"
        label={t("devices.device")}
        value={value.device}
        onChange={(event) => onChange({ ...value, device: event.target.value })}
        inputProps={{ "data-testid": `${testId}-device` }}
        error={!!error}
        sx={{ flex: "1 1 180px" }}
      />
      <TextField
        size="small"
        label={t("devices.os")}
        value={value.os}
        onChange={(event) => onChange({ ...value, os: event.target.value })}
        inputProps={{ "data-testid": `${testId}-os` }}
        error={!!error}
        helperText={error ? t(error) : t("devices.osHint")}
        sx={{ flex: "1 1 180px" }}
      />
    </>
  );
};

/**
 * The devices SDK snapshots may come from (028): the list the team agreed on,
 * and the devices snapshots already came from, so CI's can be added as the
 * tests send them.
 */
export const AllowedDevicesSettings: React.FunctionComponent = () => {
  const { projectEditState: project } = useProjectState();
  const projectDispatch = useProjectDispatch();
  const { t } = useT();
  const devices = allowedDevicesOf(project.uiTreeSettings);
  const [draft, setDraft] = React.useState<AllowedDevice>(EMPTY);
  const [received, setReceived] = React.useState<AllowedDevice[]>([]);

  React.useEffect(() => {
    if (!project.id) return;
    let current = true;
    projectsService
      .getDevices(project.id)
      .then((list) => current && setReceived(Array.isArray(list) ? list : []))
      // a suggestion only: without it the list is still edited by hand
      .catch(() => current && setReceived([]));
    return () => {
      current = false;
    };
  }, [project.id]);

  // only the list changes, the rest of the settings JSON stays as stored
  const save = (next: AllowedDevice[]) => {
    let stored: Record<string, unknown> = {};
    try {
      stored = JSON.parse(project.uiTreeSettings || "{}") ?? {};
    } catch {
      stored = {};
    }
    setProjectEditState(projectDispatch, {
      ...project,
      uiTreeSettings: JSON.stringify({ ...stored, allowedDevices: next }),
    });
  };

  const add = (entry: AllowedDevice) =>
    save([...devices, { device: entry.device.trim(), os: entry.os.trim() }]);

  const draftStarted = !!(draft.device.trim() || draft.os.trim());
  const draftProblem = invalidAllowedDevice(draft);
  const draftDuplicate = devices.some((entry) => sameDevice(entry, draft));
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
      data-testid="allowedDevices"
    >
      {devices.length === 0 && (
        <Typography variant="body2" color="textSecondary">
          {t("devices.none")}
        </Typography>
      )}
      {devices.map((entry, index) => {
        const problem = invalidAllowedDevice(entry);
        return (
          <Box
            key={index}
            data-testid={`allowedDevice-${index}`}
            sx={{
              display: "flex",
              gap: 1.5,
              alignItems: "flex-start",
              flexWrap: "wrap",
            }}
          >
            <DeviceFields
              value={entry}
              testId={`allowedDevice-${index}`}
              error={problem ? PROBLEM[problem] : undefined}
              onChange={(value) =>
                save(devices.map((item, i) => (i === index ? value : item)))
              }
            />
            <Tooltip title={t("devices.remove")}>
              <IconButton
                aria-label={t("devices.remove")}
                data-testid={`allowedDevice-${index}-remove`}
                onClick={() => save(devices.filter((_, i) => i !== index))}
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
        <DeviceFields
          value={draft}
          testId="newDevice"
          error={draftError}
          onChange={setDraft}
        />
        <Button
          variant="outlined"
          data-testid="addDevice"
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

      <Box sx={{ mt: 1 }} data-testid="receivedDevices">
        <Typography variant="subtitle2">{t("devices.received")}</Typography>
        <Typography variant="caption" color="textSecondary" component="div">
          {received.length
            ? t("devices.receivedHint")
            : t("devices.receivedNone")}
        </Typography>
        {received.map((entry) => {
          const allowed = deviceAllowed(devices, entry.device, entry.os);
          const key = `${entry.device} / ${entry.os}`;
          return (
            <Box
              key={key}
              data-testid={`receivedDevice-${key}`}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                py: 0.5,
                borderTop: 1,
                borderColor: "divider",
              }}
            >
              <Typography variant="body2" sx={{ flex: 1 }}>
                {entry.device}
                <Typography
                  component="span"
                  variant="body2"
                  color="textSecondary"
                >
                  {` · ${entry.os}`}
                </Typography>
              </Typography>
              {allowed ? (
                <Chip size="small" label={t("devices.allowed")} />
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
