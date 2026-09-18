import type { LeverConfig } from './types';

/** A sensible, all-mechanics-on starting point for a new scenario — not a fixed template. */
export function defaultLeverConfig(): LeverConfig {
  return {
    steadyStateExecution: { enabled: true, casesPerDay: 20 },
    executionDrivenIssues: { enabled: true, casesPerIssue: 5 },
    calendarDrivenIssues: { enabled: false, baseRatePerDay: 0 },
    issueInfluxEvents: { enabled: false, events: [] },
    blockedCaseThrottling: { enabled: true, blockedCasesPerIssue: 2 },
    reopenRate: { enabled: true, reopenRatePercent: 15 },
    clientReviewBuffer: { enabled: true, bufferDays: 1 },
    resolutionCapacity: { enabled: true, issuesPerDayPerFte: 2, fteCount: 3 },
  };
}
