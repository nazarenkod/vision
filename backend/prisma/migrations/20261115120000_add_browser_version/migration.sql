-- The browser version of a web screen (050): one nullable column without a default (ADR-0003).
-- Postgres adds it without rewriting the table, and runs taken before it keep NULL.
ALTER TABLE "TestRun" ADD COLUMN "browserVersion" TEXT;
