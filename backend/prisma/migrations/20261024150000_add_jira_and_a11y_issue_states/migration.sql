-- AlterTable
-- Jira connection per project. Nullable, no default: catalogue-only change.
ALTER TABLE "Project" ADD COLUMN "jiraUrl" TEXT,
                      ADD COLUMN "jiraEmail" TEXT,
                      ADD COLUMN "jiraToken" TEXT,
                      ADD COLUMN "jiraIssueType" TEXT,
                      ADD COLUMN "jiraLinkType" TEXT;

-- CreateTable
-- What the team decided about an accessibility issue on a screen: a bug was
-- filed for it, or it is a false positive. Keyed by screen and issue identity,
-- not by run, so the decision holds for every later build and device.
CREATE TABLE "A11yIssueState" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "screenName" TEXT NOT NULL,
    "violationId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "jiraKey" TEXT,
    "jiraUrl" TEXT,
    "comment" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "A11yIssueState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "A11yIssueState_projectId_screenName_violationId_key" ON "A11yIssueState"("projectId", "screenName", "violationId");
