import { TestStatus } from '@prisma/client';
import { checkTrend, TrendRow } from './check-trend';

const row = (index: number, extra: Partial<TrendRow> = {}): TrendRow => ({
  id: `run-${index}`,
  createdAt: new Date(Date.UTC(2026, 9, 1, 12, index)),
  status: TestStatus.ok,
  diffPercent: index / 10,
  build: { number: 100 + index },
  ...extra,
});

describe('checkTrend', () => {
  it('lists the runs of the check oldest first, ending with the current one', () => {
    const rows = [row(3), row(1), row(2, { status: TestStatus.unresolved })];

    expect(checkTrend(rows, 'run-3')).toEqual([
      { id: 'run-1', buildNumber: 101, createdAt: rows[1].createdAt, status: TestStatus.ok, diffPercent: 0.1 },
      { id: 'run-2', buildNumber: 102, createdAt: rows[2].createdAt, status: TestStatus.unresolved, diffPercent: 0.2 },
      { id: 'run-3', buildNumber: 103, createdAt: rows[0].createdAt, status: TestStatus.ok, diffPercent: 0.3 },
    ]);
  });

  it('keeps the last 20 runs and leaves out those after the current one', () => {
    const rows = Array.from({ length: 30 }, (_, index) => row(index));

    const trend = checkTrend(rows, 'run-24');

    expect(trend).toHaveLength(20);
    expect(trend[0].id).toBe('run-5');
    expect(trend[19].id).toBe('run-24');
  });

  it('shows the first run of a check as one bar without a diff', () => {
    const first = row(0, { status: TestStatus.new, diffPercent: null, build: { number: null } });

    expect(checkTrend([first], 'run-0')).toEqual([
      { id: 'run-0', buildNumber: null, createdAt: first.createdAt, status: TestStatus.new, diffPercent: 0 },
    ]);
  });

  it('ends with the current run even when another one has the same time', () => {
    const current = row(1);
    const twin = row(2, { createdAt: current.createdAt });

    expect(checkTrend([current, twin], 'run-1').map((point) => point.id)).toEqual(['run-2', 'run-1']);
    expect(checkTrend([current, current], 'run-1')).toHaveLength(1);
  });

  it('shows nothing for a run it was not given', () => {
    expect(checkTrend([row(1)], 'other')).toEqual([]);
  });
});
