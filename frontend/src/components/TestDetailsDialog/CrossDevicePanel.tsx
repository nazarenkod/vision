import React from "react";
import { Alert, Box, Skeleton, Typography } from "@mui/material";
import { CrossDeviceResult, TestRun } from "../../types";
import { insightsService } from "../../services";
import { tokens } from "../../theme";

const MESSAGES: Record<string, string> = {
  "no-tree": "This screenshot came without a UI tree.",
  "no-reference":
    "Choose the reference device in the project settings (Mobile screenshots) to compare other devices with it.",
  "is-reference":
    "This is the reference device; other devices are compared with it.",
  "no-reference-tree":
    "The reference device has neither a run of this check in this build nor a baseline with a UI tree.",
  "other-platform":
    "The reference device is on another platform; trees of Android and iOS are not compared.",
};

/**
 * The same check on the project's reference device, element by element. For
 * information only: positions differ between screens by nature, and an element
 * not found here may only be off screen.
 */
export const CrossDevicePanel: React.FunctionComponent<{
  testRun: TestRun;
}> = ({ testRun }) => {
  const [result, setResult] = React.useState<CrossDeviceResult | null>();

  React.useEffect(() => {
    setResult(undefined);
    insightsService
      .getCrossDevice(testRun.id)
      .then(setResult)
      .catch(() => setResult(null));
  }, [testRun.id, testRun.uiTreeName]);

  if (result === undefined) return <Skeleton variant="rounded" height={120} />;
  if (!result) {
    return (
      <Typography variant="body2" color="textSecondary">
        Could not compare with the reference device.
      </Typography>
    );
  }

  const note = (
    <Typography variant="caption" color="textSecondary">
      For information: this comparison does not change the status.
    </Typography>
  );

  if (result.status !== "compared") {
    return (
      <>
        {"referenceDevice" in result && (
          <Typography variant="subtitle2">
            Reference: {result.referenceDevice}
          </Typography>
        )}
        <Typography variant="body2" color="textSecondary">
          {MESSAGES[result.status]}
        </Typography>
        {note}
      </>
    );
  }

  const { report } = result;
  const differenceCount =
    report.truncated?.differences ?? report.differences.length;
  const notFoundCount = report.truncated?.notFound ?? report.notFound.length;
  return (
    <>
      <Box>
        <Typography variant="subtitle2">
          Compared with {result.referenceDevice}
        </Typography>
        <Typography variant="body2" color="textSecondary">
          {result.referenceSource === "run"
            ? "Its run in this build."
            : "Its baseline (no run of this check on it in this build)."}{" "}
          {report.compared} elements found on both.
        </Typography>
      </Box>
      {differenceCount === 0 ? (
        <Alert severity="success" variant="outlined">
          Elements found on both devices have the same texts, labels and states.
        </Alert>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
          <Typography variant="subtitle2">
            Different on this device ({differenceCount})
          </Typography>
          {report.differences.map((item) => (
            <Typography key={`${item.key}:${item.field}`} variant="body2">
              {item.element}: {item.field}{" "}
              <span style={{ color: tokens.textSecondary }}>
                “{item.reference || "—"}”
              </span>{" "}
              → “{item.here || "—"}”
            </Typography>
          ))}
        </Box>
      )}
      {notFoundCount > 0 && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
          <Typography variant="subtitle2">
            Not found here ({notFoundCount})
          </Typography>
          <Typography variant="body2" color="textSecondary">
            On the reference device but not in this screen’s tree: missing, or
            only off screen on a smaller display.
          </Typography>
          {report.notFound.map((item) => (
            <Typography key={item.key} variant="body2">
              {item.element}
            </Typography>
          ))}
        </Box>
      )}
      {report.onlyHere > 0 && (
        <Typography variant="body2" color="textSecondary">
          {report.onlyHere} elements are only on this device.
        </Typography>
      )}
      {note}
    </>
  );
};
