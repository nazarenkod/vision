import { TestStatus } from '@prisma/client';

/** A run of a check as the trend loads it: only what the bars and their tooltips show. */
export interface TrendRow {
  id: string;
  createdAt: Date;
  status: TestStatus;
  diffPercent: number | null;
  build: { number: number | null } | null;
}

/** One bar of the trend in the comparison header (REQ-046-08). */
export interface TrendPoint {
  id: string;
  buildNumber: number | null;
  createdAt: Date;
  status: TestStatus;
  diffPercent: number;
}

/** As many runs as the header has room for; older ones say little about the current change. */
export const TREND_LENGTH = 20;

/**
 * The last runs of a check up to the one on screen, oldest first, ending with
 * it (REQ-046-08). Runs after it are left out: opening an older build shows
 * how the check stood then, not what came later.
 */
export function checkTrend(rows: TrendRow[], currentId: string): TrendPoint[] {
  const unique = [...new Map(rows.map((row) => [row.id, row])).values()];
  const ordered = unique.sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime() || (a.id === currentId ? 1 : b.id === currentId ? -1 : 0)
  );
  const at = ordered.findIndex((row) => row.id === currentId);
  if (at < 0) return [];
  return ordered.slice(Math.max(0, at + 1 - TREND_LENGTH), at + 1).map((row) => ({
    id: row.id,
    buildNumber: row.build?.number ?? null,
    createdAt: row.createdAt,
    status: row.status,
    // a new screen or one equal to its baseline has no diff to speak of
    diffPercent: row.diffPercent ?? 0,
  }));
}
