import { useDecisionSnackbar } from "../useDecisionSnackbar";
import React from "react";
import { Box, Button, ButtonBase, Typography } from "@mui/material";
import { useSnackbar } from "notistack";
import { DoneAll } from "@mui/icons-material";
import { Tooltip } from "../Tooltip";
import { TestRun } from "../../types";
import { TestStatus } from "../../types/testStatus";
import { testRunService } from "../../services";
import { useUserState } from "../../contexts";
import { motion, tokens, type, radius } from "../../theme";
import { BaseModal } from "../BaseModal";
import { DeviceTags } from "../DeviceTags";
import { deviceLabel } from "../../_helpers/device.helper";
import { labelOf, useT } from "../../i18n";

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
  /** a narrow toolbar: one line, each device by its model, the rest on hover */
  compact?: boolean;
}> = ({ runs, currentId, onSelect, compact }) => {
  const { enqueueSnackbar } = useSnackbar();
  const { t } = useT();
  const announce = useDecisionSnackbar();
  const { user } = useUserState();
  const canEdit = user?.role === "admin" || user?.role === "editor";
  const [confirm, setConfirm] = React.useState(false);
  const pending = runs.filter((run) => PENDING.includes(run.status));

  if (runs.length < 2) return null;

  const approveAll = async () => {
    setConfirm(false);
    try {
      const decision = await testRunService.approveBulk(
        pending.map((run) => run.id),
        pending.some((run) => run.merge),
      );
      announce("approve", pending.length, decision);
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
        flexWrap: compact ? "nowrap" : "wrap",
        whiteSpace: "nowrap",
      }}
      data-testid="deviceStrip"
      role="group"
      aria-label={t("review.devices")}
    >
      {!compact && (
        <Typography variant="body2" color="textSecondary" sx={{ mr: 0.5 }}>
          {t("review.devices")}
        </Typography>
      )}
      {/* one segmented track, like the view switch: the current device is the
          raised segment. A pill with a frame round each device read as a
          second set of chips around the tags */}
      <Box
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: "2px",
          p: "2px",
          borderRadius: radius.control,
          bgcolor: tokens.subtle,
          flexShrink: 0,
        }}
      >
        {runs.map((run) => {
          const current = run.id === currentId;
          return (
            <ButtonBase
              key={run.id}
              onClick={() => !current && onSelect(run.id)}
              title={labelOf(t, "testStatus", run.status)}
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.75,
                minHeight: 28,
                px: 1,
                borderRadius: radius.control,
                fontSize: type.small,
                // the raised segment marks the current device; the tags stay grey (REQ-037-04)
                // the same mark as the chosen view beside it ("Side by side")
                bgcolor: current ? "action.selected" : "transparent",
                fontWeight: current ? 600 : 400,
                color: current ? tokens.text : tokens.textSecondary,
                transition: `background-color ${motion.fast}ms`,
                "&:hover": current ? undefined : { bgcolor: "action.hover" },
              }}
              aria-label={deviceLabel(run, undefined, t)}
              aria-current={current || undefined}
            >
              <Box
                component="span"
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: radius.pill,
                  bgcolor: dotColor(run.status),
                }}
              />
              <DeviceTags
                parts={
                  compact ? { ...run, os: "", browser: "", viewport: "" } : run
                }
              />
            </ButtonBase>
          );
        })}
      </Box>
      {canEdit &&
        pending.length > 1 &&
        (compact ? (
          // a narrow toolbar: the action by its icon and count, named on hover,
          // so the devices, the view and the tools still share one row
          <Tooltip title={t("review.approveAll", { count: pending.length })}>
            <Button
              size="small"
              onClick={() => setConfirm(true)}
              data-testid="approveAllDevices"
              aria-label={t("review.approveAll", { count: pending.length })}
              startIcon={<DoneAll />}
              sx={{ minWidth: 0, fontVariantNumeric: "tabular-nums" }}
            >
              {pending.length}
            </Button>
          </Tooltip>
        ) : (
          <Button
            size="small"
            onClick={() => setConfirm(true)}
            data-testid="approveAllDevices"
          >
            {t("review.approveAll", { count: pending.length })}
          </Button>
        ))}
      <BaseModal
        open={confirm}
        title={t("review.approveDevicesTitle", { count: pending.length })}
        submitButtonText={t("review.approve")}
        onCancel={() => setConfirm(false)}
        onSubmit={approveAll}
        content={
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <Typography variant="body2">
              {t("review.approveDevicesText")}
            </Typography>
            {pending.map((run) => (
              <DeviceTags key={run.id} parts={run} />
            ))}
          </Box>
        }
      />
    </Box>
  );
};
