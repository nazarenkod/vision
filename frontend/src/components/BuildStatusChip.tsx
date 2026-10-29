import React from "react";
import { BuildStatus } from "../types/buildStatus";
import { PillTone, StatusPill } from "./StatusPill";
import { labelOf, useT } from "../i18n";

const TONE: Partial<Record<BuildStatus, PillTone>> = {
  [BuildStatus.passed]: "passed",
  [BuildStatus.unresolved]: "changed",
  [BuildStatus.failed]: "failed",
};

export const BuildStatusChip: React.FunctionComponent<{
  status: BuildStatus;
}> = ({ status }) => {
  const { t } = useT();
  return (
    <StatusPill
      tone={TONE[status] ?? "neutral"}
      label={labelOf(t, "buildStatus", status)}
    />
  );
};
