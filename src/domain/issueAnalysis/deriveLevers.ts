import { computeArrivalRate, computeBlockedCaseImpact, computeReopenRate } from './metrics';
import type { IssueRecordLike } from './types';
import type { LeverConfig } from '@/domain/staffingModel/types';

export interface ExpectedUplift {
  reason: string;
  effectiveFrom: number; // workday offset
  adjustment: number; // additional issues/day added to the derived base rate from that day forward
}

export interface DeriveTraceEntry {
  field: string;
  formula: string;
  value: number;
}

export interface DerivedLeverProposal {
  basedOnRecordCount: number;
  startingIssues: number;
  levers: Pick<LeverConfig, 'calendarDrivenIssues' | 'blockedCaseThrottling' | 'reopenRate'>;
  trace: DeriveTraceEntry[];
}

/**
 * Derives a LeverConfig proposal from confirmed IssueRecords — never applied
 * automatically. The caller (an API route, then the scenario workspace UI)
 * always shows this as a diff against the scenario's current values for a
 * human to review and apply field by field. Only mechanics genuinely
 * observable from an issue-list export are derived: execution-driven issue
 * generation and the client review buffer need test-execution data this
 * import doesn't carry, so those levers are left for the PM to set by hand.
 */
export function deriveLevers(records: IssueRecordLike[], expectedUplifts: ExpectedUplift[] = []): DerivedLeverProposal {
  const trace: DeriveTraceEntry[] = [];

  const createdDates = records.map((r) => r.createdDate).filter((d): d is string => Boolean(d)).sort();
  const spanDays = createdDates.length > 1 ? Math.max(1, (new Date(createdDates[createdDates.length - 1]!).getTime() - new Date(createdDates[0]!).getTime()) / 86400000) : 1;
  const arrivalPoints = computeArrivalRate(records);
  const totalCreated = arrivalPoints.reduce((sum, p) => sum + p.createdCount, 0);
  const baseRatePerDay = totalCreated / spanDays;
  trace.push({ field: 'calendarDrivenIssues.baseRatePerDay', formula: `${totalCreated} issues created / ${spanDays.toFixed(1)} observed days`, value: baseRatePerDay });

  const schedule = expectedUplifts
    .filter((u) => u.reason.trim())
    .map((u) => {
      const rate = baseRatePerDay + u.adjustment;
      trace.push({
        field: `calendarDrivenIssues.schedule[day=${u.effectiveFrom}]`,
        formula: `PM-entered uplift "${u.reason}": ${baseRatePerDay.toFixed(2)} base + ${u.adjustment} adjustment`,
        value: rate,
      });
      return { day: u.effectiveFrom, ratePerDay: Math.max(0, rate) };
    });

  const blocked = computeBlockedCaseImpact(records);
  trace.push({
    field: 'blockedCaseThrottling.blockedCasesPerIssue',
    formula: `${blocked.totalBlockedTestCases} blocked cases / ${blocked.openIssueCount} open issues`,
    value: blocked.averageBlockedPerOpenIssue,
  });

  const reopen = computeReopenRate(records);
  trace.push({
    field: 'reopenRate.reopenRatePercent',
    formula: `${reopen.reopenedCount} reopened / ${reopen.resolvedCount} resolved`,
    value: reopen.reopenRatePercent,
  });

  const startingIssues = blocked.openIssueCount;
  trace.push({ field: 'startingIssues', formula: 'Count of imported issues with no resolved date', value: startingIssues });

  return {
    basedOnRecordCount: records.length,
    startingIssues,
    levers: {
      calendarDrivenIssues: { enabled: true, baseRatePerDay, schedule: schedule.length ? schedule : undefined },
      blockedCaseThrottling: { enabled: true, blockedCasesPerIssue: blocked.averageBlockedPerOpenIssue },
      reopenRate: { enabled: true, reopenRatePercent: reopen.reopenRatePercent },
    },
    trace,
  };
}
