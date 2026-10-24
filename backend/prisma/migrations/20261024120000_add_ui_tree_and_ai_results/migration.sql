-- AlterTable
-- Every new column is nullable with no default: a catalogue-only change, no table
-- rewrite. Runs ingested before this keep NULL and simply have no UI tree,
-- accessibility report or diff regions.
ALTER TABLE "TestRun" ADD COLUMN "uiTreeName" TEXT,
                      ADD COLUMN "baselineUiTreeName" TEXT,
                      ADD COLUMN "a11yReportName" TEXT,
                      ADD COLUMN "a11yNewCount" INTEGER,
                      ADD COLUMN "a11yTotalCount" INTEGER,
                      ADD COLUMN "diffRegions" TEXT;

ALTER TABLE "TestVariation" ADD COLUMN "baselineUiTreeName" TEXT;

ALTER TABLE "Baseline" ADD COLUMN "uiTreeName" TEXT;

-- CreateTable
-- Cache of AI answers, keyed by a hash of everything the answer depends on, so
-- the same question is never paid for twice.
CREATE TABLE "AiResult" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "model" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiResult_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiResult_cacheKey_key" ON "AiResult"("cacheKey");
