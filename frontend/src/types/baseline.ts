import { TestRun } from "./testRun";
import { User } from "./user";

export interface Baseline {
  id: string;
  baselineName: string;
  testVariationId: string;
  createdAt: string;
  updatedAt: string;
  // the UI tree accepted with this version; null when the test sent none (081)
  uiTreeName?: string | null;
  testRun?: TestRun;
  user?: User;
}
