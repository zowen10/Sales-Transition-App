import { describe, expect, it } from 'vitest';
import {
  computeActualsAsOf,
  computeArrivalRate,
  computeBlockedCaseImpact,
  computeIssueTypeBreakdown,
  computeReopenRate,
  computeTurnaroundTime,
} from './metrics';
import type { IssueRecordLike } from './types';

function record(overrides: Partial<IssueRecordLike>): IssueRecordLike {
  return {
    id: 'r1',
    externalId: null,
    issueType: null,
    priority: null,
    status: null,
    createdDate: null,
    resolvedDate: null,
    reopenedCount: 0,
    blockedTestCaseCount: 0,
    ...overrides,
  };
}

const records: IssueRecordLike[] = [
  record({ id: '1', issueType: 'Defect', createdDate: '2026-01-01', resolvedDate: '2026-01-04', reopenedCount: 0, blockedTestCaseCount: 0 }),
  record({ id: '2', issueType: 'Defect', createdDate: '2026-01-02', resolvedDate: '2026-01-12', reopenedCount: 1, blockedTestCaseCount: 0 }),
  record({ id: '3', issueType: 'Config', createdDate: '2026-01-03', resolvedDate: null, blockedTestCaseCount: 3 }),
  record({ id: '4', issueType: null, createdDate: '2026-01-05', resolvedDate: null, blockedTestCaseCount: 1 }),
];

describe('issueAnalysis metrics', () => {
  it('computeIssueTypeBreakdown groups by type and falls back to Unspecified', () => {
    const breakdown = computeIssueTypeBreakdown(records);
    expect(breakdown).toEqual([
      { issueType: 'Defect', count: 2, percentOfTotal: 50 },
      { issueType: 'Config', count: 1, percentOfTotal: 25 },
      { issueType: 'Unspecified', count: 1, percentOfTotal: 25 },
    ]);
  });

  it('computeArrivalRate buckets created/resolved counts by day', () => {
    const points = computeArrivalRate(records);
    expect(points.find((p) => p.date === '2026-01-01')).toMatchObject({ createdCount: 1, resolvedCount: 0 });
    expect(points.find((p) => p.date === '2026-01-04')).toMatchObject({ createdCount: 0, resolvedCount: 1 });
  });

  it('computeTurnaroundTime computes days-to-resolve stats per type', () => {
    const stats = computeTurnaroundTime(records);
    const defect = stats.find((s) => s.issueType === 'Defect');
    expect(defect?.sampleSize).toBe(2);
    expect(defect?.medianDays).toBeGreaterThan(0);
  });

  it('computeReopenRate counts resolved issues with any reopen', () => {
    const stat = computeReopenRate(records);
    expect(stat.resolvedCount).toBe(2);
    expect(stat.reopenedCount).toBe(1);
    expect(stat.reopenRatePercent).toBe(50);
  });

  it('computeBlockedCaseImpact only counts still-open issues', () => {
    const stat = computeBlockedCaseImpact(records);
    expect(stat.openIssueCount).toBe(2);
    expect(stat.totalBlockedTestCases).toBe(4);
    expect(stat.averageBlockedPerOpenIssue).toBe(2);
  });

  it('computeActualsAsOf only counts what was known by the checkpoint date', () => {
    const asOf = computeActualsAsOf(records, '2026-01-04');
    // Issues 1-3 existed by 2026-01-04 (issue 4 wasn't created until 01-05); only issue 1 resolved by then.
    expect(asOf.resolvedIssuesCumulative).toBe(1);
    expect(asOf.openBacklog).toBe(2);
  });

  it('computeActualsAsOf counts a record dated exactly on asOfDate, even as a full ISO timestamp', () => {
    // IssueRecord dates come back from Prisma as full ISO timestamps (toISOString()), not
    // plain "YYYY-MM-DD" strings — a record created/resolved exactly on the checkpoint date
    // must still count as known-by-then rather than being excluded by a naive string compare.
    const timestamped: IssueRecordLike[] = [
      record({ id: 't1', createdDate: '2026-01-06T00:00:00.000Z', resolvedDate: null }),
    ];
    const asOf = computeActualsAsOf(timestamped, '2026-01-06');
    expect(asOf.openBacklog).toBe(1);
  });
});
