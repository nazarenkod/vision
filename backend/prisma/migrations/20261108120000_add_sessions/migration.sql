-- Sign-ins kept in the database (052): a new table and a nullable column only (ADR-0003).
-- No existing row changes: tokens issued before this have no session and keep working until the
-- person signs out or changes their password, which sets tokensValidAfter.
ALTER TABLE "User" ADD COLUMN "tokensValidAfter" TIMESTAMP(3);

CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Session_userId_idx" ON "Session"("userId");

ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
