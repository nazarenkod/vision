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
  // Jira for filing bugs; everyone goes there with their own token (035)
  jiraUrl?: string | null;
  // the Gemini API key is write-only too: the settings come back without it
  geminiApiKeySet?: boolean;
  jiraIssueType?: string | null;
  jiraLinkType?: string | null;
  // JSON: UI tree comparison settings and project-wide element rules
  uiTreeSettings?: string | null;
}

/** A device SDK snapshots may come from: as the test sends `device` and `os` (029). */
/** A person given the project (042); admins reach every project and are not listed. */
export interface ProjectMember {
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: "admin" | "editor" | "guest";
  createdAt: string;
}

export interface AllowedDevice {
  device: string;
  // exact, or ending in ".*" for any version under it
  os: string;
}

export type ProjectDto = Omit<
  Project,
  "updatedAt" | "createdAt" | "builds" | "geminiApiKeySet"
>;
