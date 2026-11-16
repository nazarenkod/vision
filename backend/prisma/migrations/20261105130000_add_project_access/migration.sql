-- Who may see and work in a project (042). A new table only; the INSERT fills it, never
-- touches an existing row (ADR-0003). Prisma runs a migration once, so everyone keeps seeing
-- every project they saw before this version, and access taken away later stays taken away.
CREATE TABLE "ProjectAccess" (
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "grantedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectAccess_pkey" PRIMARY KEY ("userId","projectId")
);

CREATE INDEX "ProjectAccess_projectId_idx" ON "ProjectAccess"("projectId");

ALTER TABLE "ProjectAccess" ADD CONSTRAINT "ProjectAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectAccess" ADD CONSTRAINT "ProjectAccess_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- everyone who is here now, to every project that is here now (REQ-042-10)
INSERT INTO "ProjectAccess" ("userId", "projectId")
SELECT "User"."id", "Project"."id" FROM "User" CROSS JOIN "Project";
