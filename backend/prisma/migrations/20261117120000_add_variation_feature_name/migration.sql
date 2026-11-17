-- The feature of a baseline (067): one nullable column without a default (ADR-0003).
-- Postgres adds it without rewriting the table.
ALTER TABLE "TestVariation" ADD COLUMN "featureName" TEXT;

-- Baselines taken before it get the feature of their newest run on their own branch that named
-- one, so the page groups them at once. Only the new column is written: "updatedAt" is kept,
-- since the baseline a run compares with is chosen by it.
-- One pass over the runs (DISTINCT ON), not a lookup per baseline: runs have no index by baseline.
UPDATE "TestVariation" AS v
SET "featureName" = latest."feature"
FROM (
  SELECT DISTINCT ON (r."testVariationId") r."testVariationId" AS "id", btrim(r."featureName") AS "feature"
  FROM "TestRun" AS r
  JOIN "TestVariation" AS own ON own."id" = r."testVariationId" AND own."branchName" = r."branchName"
  WHERE btrim(coalesce(r."featureName", '')) <> ''
  ORDER BY r."testVariationId", r."createdAt" DESC
) AS latest
WHERE v."id" = latest."id";
