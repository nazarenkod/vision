-- CreateTable
-- Journal of approve and reject decisions for Undo (018, ADR-0014). A new
-- table with no foreign keys: nothing existing changes, and deleting runs or
-- variations is never blocked by it.
CREATE TABLE "ReviewDecision" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "kind" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "undoneAt" TIMESTAMP(3),

    CONSTRAINT "ReviewDecision_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReviewDecision_createdAt_idx" ON "ReviewDecision"("createdAt");
