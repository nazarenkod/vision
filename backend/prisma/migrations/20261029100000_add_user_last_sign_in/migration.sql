-- AlterTable
-- When a person last signed in to the web interface (018, Users). Nullable,
-- no default: existing rows read "never signed in since", nothing is rewritten.
ALTER TABLE "User" ADD COLUMN "lastSignInAt" TIMESTAMP(3);
