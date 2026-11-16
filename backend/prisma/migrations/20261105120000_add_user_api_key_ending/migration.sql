-- The last characters of a person's API key (044): the key itself is stored only as a hash
-- and shown once, so the profile tells keys apart by this. Nullable, no default: existing rows
-- have no key anyone was shown and stay as they are.
ALTER TABLE "User" ADD COLUMN "apiKeyEnding" TEXT;
