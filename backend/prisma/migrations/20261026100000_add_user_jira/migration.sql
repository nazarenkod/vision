-- AlterTable
-- Personal Jira credentials, so bugs are filed as the person who files them.
-- Nullable, no default: catalogue-only change.
ALTER TABLE "User" ADD COLUMN "jiraToken" TEXT,
                   ADD COLUMN "jiraEmail" TEXT;
