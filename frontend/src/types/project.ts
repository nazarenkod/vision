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
  bulkApproveVariations: boolean;
  bulkApproveGroupBy: string;
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

export type ProjectDto = Omit<
  Project,
  "updatedAt" | "createdAt" | "builds" | "jiraTokenSet" | "geminiApiKeySet"
> & {
  // write-only: undefined keeps the stored token, an empty string removes it
  jiraToken?: string;
};
