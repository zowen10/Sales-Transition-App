import type {
  ArrivalRatePoint,
  BlockedCaseImpactStat,
  IssueRecordLike,
  IssueTypeBreakdownRow,
  ReopenRateStat,
  TurnaroundTimeStat,
} from './types';

function dayMs(a: string, b: string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / 86400000;
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx] ?? 0;
}

export function computeIssueTypeBreakdown(records: IssueRecordLike[]): IssueTypeBreakdownRow[] {
  const counts = new Map<string, number>();
  for (const r of records) {
    const type = r.issueType?.trim() || 'Unspecified';
    counts.set(type, (counts.get(type) ?? 0) + 1);
  }
  const total = records.length || 1;
  return [...counts.entries()]
    .map(([issueType, count]) => ({ issueType, count, percentOfTotal: (count / total) * 100 }))
    .sort((a, b) => b.count - a.count);
}

/** Buckets issue creation/resolution counts by calendar day, for an arrival/backlog-trend chart. */
export function computeArrivalRate(records: IssueRecordLike[]): ArrivalRatePoint[] {
  const buckets = new Map<string, { created: number; resolved: number }>();
  for (const r of records) {
    if (r.createdDate) {
      const day = r.createdDate.slice(0, 10);
      const bucket = buckets.get(day) ?? { created: 0, resolved: 0 };
      bucket.created += 1;
      buckets.set(day, bucket);
    }
    if (r.resolvedDate) {
      const day = r.resolvedDate.slice(0, 10);
      const bucket = buckets.get(day) ?? { created: 0, resolved: 0 };
      bucket.resolved += 1;
      buckets.set(day, bucket);
    }
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, b]) => ({ date, createdCount: b.created, resolvedCount: b.resolved }));
}

export function computeTurnaroundTime(records: IssueRecordLike[]): TurnaroundTimeStat[] {
  const byType = new Map<string, number[]>();
  for (const r of records) {
    if (!r.createdDate || !r.resolvedDate) continue;
    const days = dayMs(r.createdDate, r.resolvedDate);
    if (days < 0) continue;
    const type = r.issueType?.trim() || 'Unspecified';
    const list = byType.get(type) ?? [];
    list.push(days);
    byType.set(type, list);
  }
  return [...byType.entries()]
    .map(([issueType, days]) => {
      const sorted = [...days].sort((a, b) => a - b);
      return {
        issueType,
        sampleSize: sorted.length,
        medianDays: percentile(sorted, 50),
        p90Days: percentile(sorted, 90),
      };
    })
    .sort((a, b) => b.sampleSize - a.sampleSize);
}

export function computeReopenRate(records: IssueRecordLike[]): ReopenRateStat {
  const resolved = records.filter((r) => r.resolvedDate);
  const reopenedCount = resolved.reduce((sum, r) => sum + (r.reopenedCount > 0 ? 1 : 0), 0);
  return {
    resolvedCount: resolved.length,
    reopenedCount,
    reopenRatePercent: resolved.length ? (reopenedCount / resolved.length) * 100 : 0,
  };
}

export function computeBlockedCaseImpact(records: IssueRecordLike[]): BlockedCaseImpactStat {
  const open = records.filter((r) => !r.resolvedDate);
  const totalBlocked = open.reduce((sum, r) => sum + r.blockedTestCaseCount, 0);
  return {
    openIssueCount: open.length,
    totalBlockedTestCases: totalBlocked,
    averageBlockedPerOpenIssue: open.length ? totalBlocked / open.length : 0,
  };
}

/** What's actually known as of a checkpoint date, straight from the confirmed IssueRecords — never extrapolated. */
export function computeActualsAsOf(records: IssueRecordLike[], asOfDate: string) {
  const knownByAsOf = records.filter((r) => !r.createdDate || r.createdDate <= asOfDate);
  const resolvedByAsOf = knownByAsOf.filter((r) => r.resolvedDate && r.resolvedDate <= asOfDate);
  const openBacklog = knownByAsOf.length - resolvedByAsOf.length;
  return { asOfDate, resolvedIssuesCumulative: resolvedByAsOf.length, openBacklog };
}
