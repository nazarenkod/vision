-- Marks AI answers made on a person's own Gemini key (025), so the instance's daily limit
-- counts only its own calls. Nullable, no default: existing rows stay as they are and
-- keep counting, as they did before.
ALTER TABLE "AiResult" ADD COLUMN "personal" BOOLEAN;
