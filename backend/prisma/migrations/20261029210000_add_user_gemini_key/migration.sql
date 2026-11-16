-- A person's own Gemini API key, for drafting bugs from the comparison (025).
-- Nullable, no default: existing users simply have none; nothing is rewritten.
ALTER TABLE "User" ADD COLUMN "geminiApiKey" TEXT;
