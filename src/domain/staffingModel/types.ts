/**
 * Staffing / issue-burn domain types.
 *
 * Like the estimation engine, this simulation is deterministic: every field
 * here is either an explicit input (a lever's enabled flag + params) or a
 * value calculated from those inputs. No field is ever populated by an LLM —
 * the chat/derive-from-import features only ever produce a *proposed*
 * LeverConfig for a human to review and apply; the engine below is the only
 * thing that ever computes a number.
 *
 * Day indices throughout are workday offsets from a scenario's plan-start
 * date (day 0 = plan start), matching the reference calculator's own
 * workday-index convention (`targetWorkday`/`mockDay` in the uploaded
 * go_live_recovery_calculator_client.html).
 */

export interface IssueInfluxEvent {
  id: string;
  label: string;
  day: number; // workday offset from plan start
  issueCount: number;
}

export interface CalendarIssueRatePoint {
  /** Workday offset from plan start at which this rate takes effect. */
  day: number;
  ratePerDay: number;
}

export interface LeverConfig {
  /** The base clock: steady-state test-case execution pace. Disabling it models zero execution. */
  steadyStateExecution: { enabled: boolean; casesPerDay: number };
  /** New issues generated in proportion to cases executed (the reference calculator's mechanic). */
  executionDrivenIssues: { enabled: boolean; casesPerIssue: number };
  /** New issues arriving on an independent calendar rate, decoupled from execution pace. */
  calendarDrivenIssues: { enabled: boolean; baseRatePerDay: number; schedule?: CalendarIssueRatePoint[] };
  /** Zero or more one-off issue spikes (generalizes the reference calculator's single "Mock Go-Live" event). */
  issueInfluxEvents: { enabled: boolean; events: IssueInfluxEvent[] };
  /** Open issues block a proportional number of test cases from executing. */
  blockedCaseThrottling: { enabled: boolean; blockedCasesPerIssue: number };
  /** A percentage of resolved-original issues reopen and re-enter the queue. */
  reopenRate: { enabled: boolean; reopenRatePercent: number };
  /** Delay (workdays) before a newly created or reopened issue is eligible for resolution. */
  clientReviewBuffer: { enabled: boolean; bufferDays: number };
  /** Issue-resolution capacity: FTEs x issues resolved per day per FTE. */
  resolutionCapacity: { enabled: boolean; issuesPerDayPerFte: number; fteCount: number };
}

export interface ScenarioInput {
  /** ISO date the scenario's workday offsets (day 0) are anchored to — lets a checkpoint's real calendar date be converted into a workday offset. */
  planStartDate: string;
  totalTestCases: number;
  startingIssues: number;
  /** Workday offset used by insight/gate calculations (e.g. the target Go-Live date). */
  targetWorkday: number;
  levers: LeverConfig;
  /** Safety cap on the simulation loop; defaults to 1000 workdays. */
  maxSimulationDays?: number;
}

export interface SimulationRow {
  day: number;
  executedCumulative: number;
  generatedCumulative: number;
  reopenedCumulative: number;
  influxAddedToday: number;
  issueWorkCumulative: number; // generated + reopened + influx, cumulative
  backlog: number;
  blocked: number;
  remaining: number;
}

export interface SimulationTraceEntry {
  day: number;
  lever: keyof LeverConfig | 'core';
  note: string;
  value: number;
}

export interface SimulationResult {
  rows: SimulationRow[];
  /** Workday on which the open-issue queue fully clears (0 if it never clears within maxSimulationDays). */
  clearDay: number;
  capacityPerDay: number;
  totalIssueWork: number;
  totalGenerated: number;
  totalReopened: number;
  totalInflux: number;
  totalCalendarDriven: number;
  trace: SimulationTraceEntry[];
}

export interface FteSensitivityRow {
  fteCount: number;
  capacityPerDay: number;
  clearDay: number;
  onTime: boolean;
  daysLateOrEarly: number; // negative = early
}

export interface ActualsSnapshot {
  asOfDay: number;
  /** Omitted when the source data can't support it — an issue-list export alone has no test-execution counts. Never guessed. */
  executedCases?: number;
  openBacklog: number;
  resolvedIssuesCumulative: number;
}

export interface VarianceMetric {
  metric: 'executedCases' | 'openBacklog' | 'resolvedIssuesCumulative';
  forecast: number;
  actual: number;
  delta: number; // actual - forecast
  status: 'ahead' | 'on_track' | 'behind';
}

export interface VarianceSummary {
  asOfDay: number;
  metrics: VarianceMetric[];
}
