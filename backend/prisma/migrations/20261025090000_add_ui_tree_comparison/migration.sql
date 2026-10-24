-- AlterTable
-- Nullable, no default: catalogue-only changes. NULL means "defaults" for the
-- settings and "not checked" for the per-run results.
ALTER TABLE "Project" ADD COLUMN "uiTreeSettings" TEXT;

ALTER TABLE "TestVariation" ADD COLUMN "elementRules" TEXT;

ALTER TABLE "TestRun" ADD COLUMN "uiTreeOptions" TEXT,
                      ADD COLUMN "captureWarnings" TEXT,
                      ADD COLUMN "semanticChangeCount" INTEGER,
                      ADD COLUMN "componentChanges" TEXT;
