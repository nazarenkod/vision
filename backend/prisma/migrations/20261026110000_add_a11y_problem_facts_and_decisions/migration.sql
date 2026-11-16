-- AlterTable
-- The facts a problem was decided for, so what is one problem is worked out
-- again under changed settings while ids and bugs stay. Nullable, no default.
ALTER TABLE "A11yProblem" ADD COLUMN "rule" TEXT,
                          ADD COLUMN "facets" JSONB;

-- CreateTable
-- The record of every decision on an accessibility problem. New table only.
CREATE TABLE "A11yDecision" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "problemId" TEXT,
    "code" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "jiraKey" TEXT,
    "screenName" TEXT NOT NULL,
    "comment" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "A11yDecision_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "A11yDecision_projectId_jiraKey_idx" ON "A11yDecision"("projectId", "jiraKey");
CREATE INDEX "A11yDecision_projectId_code_idx" ON "A11yDecision"("projectId", "code");
