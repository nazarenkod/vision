-- Build overview and report (031). Additive only (ADR-0003):
-- a nullable column that stays null on existing runs, and a new table with no
-- foreign keys, so upstream deletion of builds and users works as before.
ALTER TABLE "TestRun" ADD COLUMN "decidedById" TEXT;

CREATE TABLE "ReportLink" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "buildId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sections" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "ReportLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReportLink_token_key" ON "ReportLink"("token");
CREATE INDEX "ReportLink_buildId_idx" ON "ReportLink"("buildId");
