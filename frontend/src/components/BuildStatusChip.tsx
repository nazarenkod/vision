import React from "react";
import { BuildStatus } from "../types/buildStatus";
import { PillTone, StatusPill } from "./StatusPill";

const TONE: Partial<Record<BuildStatus, PillTone>> = {
  [BuildStatus.passed]: "passed",
  [BuildStatus.unresolved]: "changed",
  [BuildStatus.failed]: "failed",
};

export const BuildStatusChip: React.FunctionComponent<{
  status: BuildStatus;
}> = ({ status }) => <StatusPill tone={TONE[status] ?? "neutral"} label={status} />;
