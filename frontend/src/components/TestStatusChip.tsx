import React from "react";
import { TestStatus } from "../types/testStatus";
import { PillTone, StatusPill } from "./StatusPill";
import { labelOf, useT } from "../i18n";

const TONE: Record<string, PillTone> = {
  [TestStatus.new]: "new",
  [TestStatus.unresolved]: "changed",
  [TestStatus.failed]: "failed",
  [TestStatus.approved]: "passed",
  [TestStatus.autoApproved]: "passed",
  [TestStatus.ok]: "passed",
};

const TestStatusChip: React.FunctionComponent<{
  status: string | undefined;
}> = ({ status }) => {
  const { t } = useT();
  return (
    <StatusPill
      tone={(status && TONE[status]) || "neutral"}
      label={status && labelOf(t, "testStatus", status)}
    />
  );
};

export default TestStatusChip;
