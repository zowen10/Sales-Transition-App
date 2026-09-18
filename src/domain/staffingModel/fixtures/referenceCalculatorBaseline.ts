import type { LeverConfig, ScenarioInput } from '../types';

/**
 * Baseline reproduced from the client-supplied reference prototype
 * (go_live_recovery_calculator_client.html`'s `BASE` constant). Workday
 * offsets (`targetWorkday`, the Mock Go-Live event's `day`) were computed
 * from the reference's own date fields the same way it computes them
 * (`Math.round(dayDiff(planStart, otherDate) / 7 * 5)`):
 *
 *   planStart: 2026-09-21, currentGoLive: 2026-11-09 -> targetWorkday 35
 *   planStart: 2026-09-21, mockGoLive:    2026-10-30 -> influx event day 28
 *
 * Ground truth for the parity tests in engine.test.ts (clearDay, capacity,
 * totalIssueWork, and the cumulative row values at days 1/5/10/20/28/35/36)
 * was produced by extracting the reference's own `simulate()` function
 * (no DOM) and running it in Node against this exact same data — the same
 * technique already used for the estimation engine's calculator-parity
 * tests (see src/domain/estimation/engine.test.ts).
 */
export const REFERENCE_TARGET_WORKDAY = 35;
export const REFERENCE_MOCK_GO_LIVE_DAY = 28;
export const REFERENCE_MOCK_GO_LIVE_ISSUES = 20;

export const REFERENCE_LEVERS: LeverConfig = {
  steadyStateExecution: { enabled: true, casesPerDay: 20 },
  executionDrivenIssues: { enabled: true, casesPerIssue: 5 },
  calendarDrivenIssues: { enabled: false, baseRatePerDay: 0 },
  issueInfluxEvents: {
    enabled: true,
    events: [{ id: 'mock-go-live', label: 'Mock Go-Live', day: REFERENCE_MOCK_GO_LIVE_DAY, issueCount: REFERENCE_MOCK_GO_LIVE_ISSUES }],
  },
  blockedCaseThrottling: { enabled: true, blockedCasesPerIssue: 2 },
  reopenRate: { enabled: true, reopenRatePercent: 15 },
  clientReviewBuffer: { enabled: true, bufferDays: 1 },
  resolutionCapacity: { enabled: true, issuesPerDayPerFte: 2, fteCount: 3 },
};

export function referenceScenarioInput(overrides: Partial<ScenarioInput> = {}): ScenarioInput {
  return {
    planStartDate: '2026-09-21',
    totalTestCases: 450,
    startingIssues: 22,
    targetWorkday: REFERENCE_TARGET_WORKDAY,
    levers: REFERENCE_LEVERS,
    ...overrides,
  };
}
