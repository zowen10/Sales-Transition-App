import { describe, expect, it } from 'vitest';
import { deriveLevers } from './deriveLevers';
import type { IssueRecordLike } from './types';

function record(overrides: Partial<IssueRecordLike>): IssueRecordLike {
  return {
    id: 'r',
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

describe('deriveLevers', () => {
  const records: IssueRecordLike[] = [
    record({ id: '1', createdDate: '2026-01-01', resolvedDate: '2026-01-04', reopenedCount: 0, blockedTestCaseCount: 0 }),
    record({ id: '2', createdDate: '2026-01-02', resolvedDate: '2026-01-12', reopenedCount: 1, blockedTestCaseCount: 0 }),
    record({ id: '3', createdDate: '2026-01-03', resolvedDate: null, blockedTestCaseCount: 4 }),
    record({ id: '4', createdDate: '2026-01-05', resolvedDate: null, blockedTestCaseCount: 2 }),
  ];

  it('derives a calendar issue rate from the observed creation span', () => {
    const proposal = deriveLevers(records);
    // 4 issues created across a 4-day span (Jan 1 -> Jan 5) = 1/day.
    expect(proposal.levers.calendarDrivenIssues.baseRatePerDay).toBeCloseTo(1, 6);
    expect(proposal.levers.calendarDrivenIssues.enabled).toBe(true);
  });

  it('derives blocked-case throttling and reopen rate from open/resolved issues', () => {
    const proposal = deriveLevers(records);
    expect(proposal.levers.blockedCaseThrottling.blockedCasesPerIssue).toBeCloseTo(3, 6); // (4+2)/2 open issues
    expect(proposal.levers.reopenRate.reopenRatePercent).toBeCloseTo(50, 6); // 1 of 2 resolved reopened
    expect(proposal.startingIssues).toBe(2); // 2 still-open issues
  });

  it('layers an expected uplift onto the base rate as a labeled schedule point, never silently', () => {
    const proposal = deriveLevers(records, [{ reason: 'UAT typically runs hotter', effectiveFrom: 20, adjustment: 2 }]);
    expect(proposal.levers.calendarDrivenIssues.schedule).toEqual([{ day: 20, ratePerDay: 3 }]);
    expect(proposal.trace.some((t) => t.formula.includes('UAT typically runs hotter'))).toBe(true);
  });

  it('never applies without an uplift entered — no schedule when none given', () => {
    const proposal = deriveLevers(records, []);
    expect(proposal.levers.calendarDrivenIssues.schedule).toBeUndefined();
  });
});
