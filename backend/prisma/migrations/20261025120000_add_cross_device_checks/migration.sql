-- CreateTable
CREATE TABLE "CrossDeviceCheck" (
    "id" TEXT NOT NULL,
    "testRunId" TEXT NOT NULL,
    "referenceSource" TEXT NOT NULL,
    "referenceTestRunId" TEXT,
    "referenceDevice" TEXT NOT NULL,
    "comparedCount" INTEGER NOT NULL,
    "differenceCount" INTEGER NOT NULL,
    "notFoundCount" INTEGER NOT NULL,
    "onlyHereCount" INTEGER NOT NULL,
    "report" TEXT NOT NULL,
    "decision" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrossDeviceCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CrossDeviceCheck_testRunId_key" ON "CrossDeviceCheck"("testRunId");

-- CreateIndex
CREATE INDEX "TestVariation_projectId_name_idx" ON "TestVariation"("projectId", "name");
