-- CreateTable
-- Accessibility problems decided once per project (rule + component + values),
-- so one bug covers the problem on every screen. The unique key doubles as the
-- lock against two people filing the same bug at once. New table only.
CREATE TABLE "A11yProblem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "jiraKey" TEXT,
    "jiraUrl" TEXT,
    "comment" TEXT,
    "screenName" TEXT NOT NULL,
    "screenTitle" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "A11yProblem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "A11yProblem_projectId_key_key" ON "A11yProblem"("projectId", "key");
CREATE INDEX "A11yProblem_projectId_code_idx" ON "A11yProblem"("projectId", "code");
