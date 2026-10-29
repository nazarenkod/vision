import React from "react";
import { Alert, Box, Skeleton, Typography } from "@mui/material";
import { CrossDeviceResult, TestRun } from "../../types";
import { insightsService } from "../../services";
import { tokens } from "../../theme";
import { MessageKey, useT } from "../../i18n";

const MESSAGES: Record<string, MessageKey> = {
  "no-tree": "crossDevice.noTree",
  "no-reference": "crossDevice.noReference",
  "is-reference": "crossDevice.isReference",
  "no-reference-tree": "crossDevice.noReferenceTree",
  "other-platform": "crossDevice.otherPlatform",
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
  const { t } = useT();

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
        {t("crossDevice.failed")}
      </Typography>
    );
  }

  const note = (
    <Typography variant="caption" color="textSecondary">
      {t("crossDevice.note")}
    </Typography>
  );

  if (result.status !== "compared") {
    return (
      <>
        {"referenceDevice" in result && (
          <Typography variant="subtitle2">
            {t("crossDevice.reference", { device: result.referenceDevice })}
          </Typography>
        )}
        <Typography variant="body2" color="textSecondary">
          {MESSAGES[result.status] ? t(MESSAGES[result.status]) : result.status}
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
          {t("crossDevice.comparedWith", { device: result.referenceDevice })}
        </Typography>
        <Typography variant="body2" color="textSecondary">
          {result.referenceSource === "run"
            ? t("crossDevice.itsRun")
            : t("crossDevice.itsBaseline")}{" "}
          {t("crossDevice.foundOnBoth", { count: report.compared })}
        </Typography>
      </Box>
      {differenceCount === 0 ? (
        <Alert severity="success" variant="outlined">
          {t("crossDevice.same")}
        </Alert>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
          <Typography variant="subtitle2">
            {t("crossDevice.different", { count: differenceCount })}
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
            {t("crossDevice.notFound", { count: notFoundCount })}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            {t("crossDevice.notFoundHelp")}
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
          {t("crossDevice.onlyHere", { count: report.onlyHere })}
        </Typography>
      )}
      {note}
    </>
  );
};
