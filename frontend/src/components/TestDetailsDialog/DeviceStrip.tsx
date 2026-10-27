import React from "react";
import { Box, Button, ButtonBase, Typography } from "@mui/material";
import { useSnackbar } from "notistack";
import { TestRun } from "../../types";
import { TestStatus } from "../../types/testStatus";
import { testRunService } from "../../services";
import { useUserState } from "../../contexts";
import { tokens } from "../../theme";
import { BaseModal } from "../BaseModal";
import { deviceLabel } from "../../_helpers/device.helper";

export { deviceLabel };

/** Runs of the same check (name and custom tags) in a list, one per device. */
export const runsOfCheck = (runs: TestRun[], run: TestRun) =>
  runs
    .filter(
      (item) =>
        item.name === run.name &&
        (item.customTags ?? "") === (run.customTags ?? ""),
    )
    .sort((a, b) => deviceLabel(a).localeCompare(deviceLabel(b)));

const PENDING: string[] = [TestStatus.unresolved, TestStatus.new];

const dotColor = (status: string) =>
  status === TestStatus.unresolved
    ? tokens.status.changed.fg
    : status === TestStatus.new
      ? tokens.status.new.fg
      : status === TestStatus.failed
        ? tokens.status.failed.fg
        : tokens.status.passed.fg;

/**
 * Every device a check ran on in this build, side by side: one click moves
 * between them, and the ones still waiting can be approved at once.
 */
export const DeviceStrip: React.FunctionComponent<{
  runs: TestRun[];
  currentId: string;
  onSelect: (id: string) => void;
}> = ({ runs, currentId, onSelect }) => {
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useUserState();
  const canEdit = user?.role === "admin" || user?.role === "editor";
  const [confirm, setConfirm] = React.useState(false);
  const pending = runs.filter((run) => PENDING.includes(run.status));

  if (runs.length < 2) return null;

  const approveAll = async () => {
    setConfirm(false);
    try {
      await testRunService.approveBulk(
        pending.map((run) => run.id),
        pending.some((run) => run.merge),
      );
      enqueueSnackbar(`Approved ${pending.length} devices`, {
        variant: "success",
      });
    } catch (error) {
      enqueueSnackbar(String(error), { variant: "error" });
    }
  };

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.75,
        flexWrap: "wrap",
      }}
      data-testid="deviceStrip"
    >
      <Typography variant="body2" color="textSecondary" sx={{ mr: 0.5 }}>
        Devices
      </Typography>
      {runs.map((run) => {
        const current = run.id === currentId;
        return (
          <ButtonBase
            key={run.id}
            onClick={() => !current && onSelect(run.id)}
            title={run.status}
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.75,
              height: 26,
              px: 1.25,
              borderRadius: 999,
              fontSize: 12.5,
              border: `1px solid ${current ? tokens.brand : tokens.border}`,
              bgcolor: current ? tokens.brandSoft : tokens.surface,
              color: tokens.text,
              fontWeight: current ? 600 : 400,
            }}
          >
            <Box
              component="span"
              sx={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                bgcolor: dotColor(run.status),
              }}
            />
            {deviceLabel(run)}
          </ButtonBase>
        );
      })}
      {canEdit && pending.length > 1 && (
        <Button size="small" onClick={() => setConfirm(true)}>
          Approve all {pending.length}
        </Button>
      )}
      <BaseModal
        open={confirm}
        title={`Approve ${pending.length} devices?`}
        submitButtonText="Approve"
        onCancel={() => setConfirm(false)}
        onSubmit={approveAll}
        content={
          <Typography variant="body2">
            Each becomes the baseline for its device:{" "}
            {pending.map((run) => deviceLabel(run)).join(", ")}.
          </Typography>
        }
      />
    </Box>
  );
};
