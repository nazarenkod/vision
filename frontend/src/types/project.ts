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
/** A person given the project (042); someone made admin later stays listed, though admins reach every project anyway. */
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

/**
 * A browser web snapshots may come from (050): as the test sends `browser`,
 * `browserVersion` and `viewport`. An empty version or window size is any.
 */
export interface AllowedBrowser {
  browser: string;
  // exact, or ending in ".*" for any version under it; empty: any
  version: string;
  // window size as "1280x720"; empty: any
  viewport: string;
}

/** What the project tests: which settings its page shows (050). */
export type ProjectPlatform = "mobile" | "web" | "both";

export type ProjectDto = Omit<
  Project,
  "updatedAt" | "createdAt" | "builds" | "geminiApiKeySet"
>;
