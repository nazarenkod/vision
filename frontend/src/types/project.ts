import { Build } from "./build";
import { ImageComparison } from "./imageComparison";

export interface Project {
  id: string;
  name: string;
  mainBranchName: string;
  builds: Build[];
  updatedAt: string;
  createdAt: string;
  autoApproveFeature: boolean;
  imageComparison: ImageComparison;
  imageComparisonConfig: string;
  maxBuildAllowed: number;
  maxBranchLifetime: number;
  // Jira for filing accessibility bugs; the token itself never comes back from the API
  jiraUrl?: string | null;
  jiraEmail?: string | null;
  jiraTokenSet?: boolean;
  // the Gemini API key is write-only too: the settings come back without it
  geminiApiKeySet?: boolean;
  jiraIssueType?: string | null;
  jiraLinkType?: string | null;
  // JSON: UI tree comparison settings and project-wide element rules
  uiTreeSettings?: string | null;
}

/** A device SDK snapshots may come from: as the test sends `device` and `os` (028). */
export interface AllowedDevice {
  device: string;
  // exact, or ending in ".*" for any version under it
  os: string;
}

export type ProjectDto = Omit<
  Project,
  "updatedAt" | "createdAt" | "builds" | "jiraTokenSet" | "geminiApiKeySet"
> & {
  // write-only: undefined keeps the stored token, an empty string removes it
  jiraToken?: string;
};
