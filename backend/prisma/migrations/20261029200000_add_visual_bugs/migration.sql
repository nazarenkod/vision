-- Bugs from the comparison (025). Both changes are additive (ADR-0003).

-- Nullable, no default: existing runs and clients that do not send it keep
-- working; it is not part of the variation key, so no baseline changes.
ALTER TABLE "TestRun" ADD COLUMN "featureName" TEXT;

-- A new table with no foreign keys: upstream code that deletes runs and
-- variations never touches it.
CREATE TABLE "VisualBug" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "checkName" TEXT NOT NULL,
    "customTags" TEXT NOT NULL DEFAULT '',
    "testRunId" TEXT NOT NULL,
    "device" TEXT NOT NULL DEFAULT '',
    "jiraKey" TEXT NOT NULL,
    "jiraUrl" TEXT,
    "summary" TEXT NOT NULL,
    "marks" TEXT NOT NULL DEFAULT '[]',
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisualBug_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VisualBug_projectId_checkName_customTags_idx" ON "VisualBug"("projectId", "checkName", "customTags");
