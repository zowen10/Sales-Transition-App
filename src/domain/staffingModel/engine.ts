import type {
  FteSensitivityRow,
  LeverConfig,
  ScenarioInput,
  SimulationResult,
  SimulationRow,
  SimulationTraceEntry,
} from './types';

const EPS = 1e-6;

function calendarRateAt(day: number, lever: LeverConfig['calendarDrivenIssues']): number {
  if (!lever.enabled) return 0;
  const schedule = lever.schedule ?? [];
  if (!schedule.length) return lever.baseRatePerDay;
  let rate = lever.baseRatePerDay;
  for (const point of [...schedule].sort((a, b) => a.day - b.day)) {
    if (point.day <= day) rate = point.ratePerDay;
  }
  return rate;
}

function influxAt(day: number, lever: LeverConfig['issueInfluxEvents']): number {
  if (!lever.enabled) return 0;
  return lever.events.filter((e) => e.day === day).reduce((sum, e) => sum + e.issueCount, 0);
}

function maxInfluxDay(lever: LeverConfig['issueInfluxEvents']): number {
  if (!lever.enabled || !lever.events.length) return 0;
  return Math.max(...lever.events.map((e) => e.day));
}

/**
 * Generalized, lever-driven port of the reference calculator's `simulate()`
 * (go_live_recovery_calculator_client.html). A lever's `enabled: false`
 * removes its mechanic from the model entirely rather than zeroing a value
 * that still participates structurally — see engine.test.ts for parity
 * against the reference calculator's own baseline output, and per-lever
 * tests for the disabled behavior of each mechanic.
 */
export function runIssueBurnSimulation(input: ScenarioInput): SimulationResult {
  const levers = input.levers;
  const maxDays = input.maxSimulationDays ?? 1000;

  const casesPerDay = levers.steadyStateExecution.enabled ? Math.max(0, levers.steadyStateExecution.casesPerDay) : 0;
  const casesPerIssue = levers.executionDrivenIssues.enabled ? Math.max(0.1, levers.executionDrivenIssues.casesPerIssue) : 0.1;
  const blockedPer = levers.blockedCaseThrottling.enabled ? Math.max(0, levers.blockedCaseThrottling.blockedCasesPerIssue) : 0;
  const cap = levers.resolutionCapacity.enabled
    ? Math.max(0, levers.resolutionCapacity.issuesPerDayPerFte) * Math.max(0, levers.resolutionCapacity.fteCount)
    : 0;
  const reopenFraction = levers.reopenRate.enabled ? Math.max(0, levers.reopenRate.reopenRatePercent) / 100 : 0;
  const bufferDays = levers.clientReviewBuffer.enabled ? Math.max(0, Math.round(levers.clientReviewBuffer.bufferDays)) : 0;
  const reopenDelay = bufferDays > 0 ? bufferDays : 1;
  const gateDay = maxInfluxDay(levers.issueInfluxEvents);

  const total = Math.max(0, input.totalTestCases);
  const start = Math.max(0, input.startingIssues);

  let remaining = total;
  let backlog = start;
  let blocked = Math.min(remaining, start * blockedPer);
  let eligibleOriginal = 0;
  let eligibleReopen = 0;
  let originalPending = start;
  let reopenPending = 0;

  const originalDue = new Array<number>(maxDays + 50).fill(0);
  const reopenDue = new Array<number>(maxDays + 50).fill(0);

  let cumulativeExecuted = 0;
  let cumulativeGenerated = 0;
  let cumulativeReopened = 0;
  let cumulativeInflux = 0;
  let cumulativeCalendar = 0;

  if (bufferDays === 0) eligibleOriginal = start;
  else originalDue[1 + bufferDays] = start;

  const trace: SimulationTraceEntry[] = [
    { day: 0, lever: 'core', note: 'Starting backlog seeded into original queue', value: start },
  ];

  const rows: SimulationRow[] = [
    { day: 0, executedCumulative: 0, generatedCumulative: 0, reopenedCumulative: 0, influxAddedToday: 0, issueWorkCumulative: 0, backlog, blocked, remaining },
  ];

  let clearDay = 0;

  for (let day = 1; day < maxDays; day++) {
    const dueOriginal = originalDue[day] || 0;
    const dueReopen = reopenDue[day] || 0;
    originalPending = Math.max(0, originalPending - dueOriginal);
    reopenPending = Math.max(0, reopenPending - dueReopen);
    eligibleOriginal += dueOriginal;
    eligibleReopen += dueReopen;
    backlog += dueReopen;
    blocked = Math.min(remaining, blocked + dueReopen * blockedPer);

    const influxToday = influxAt(day, levers.issueInfluxEvents);
    const calendarToday = calendarRateAt(day, levers.calendarDrivenIssues);
    const newFromInflux = influxToday + calendarToday;
    if (newFromInflux) {
      cumulativeInflux += influxToday;
      cumulativeCalendar += calendarToday;
      backlog += newFromInflux;
      blocked = Math.min(remaining, blocked + newFromInflux * blockedPer);
      originalPending += newFromInflux;
      if (bufferDays === 0) eligibleOriginal += newFromInflux;
      else originalDue[day + bufferDays] = (originalDue[day + bufferDays] || 0) + newFromInflux;
      if (influxToday) trace.push({ day, lever: 'issueInfluxEvents', note: 'Issue influx event added', value: influxToday });
    }

    const executed = levers.blockedCaseThrottling.enabled
      ? Math.min(remaining, casesPerDay, Math.max(0, remaining - blocked))
      : Math.min(remaining, casesPerDay);

    const generated = levers.executionDrivenIssues.enabled ? executed / casesPerIssue : 0;
    if (generated) {
      backlog += generated;
      blocked = Math.min(remaining, blocked + generated * blockedPer);
      originalPending += generated;
      if (bufferDays === 0) eligibleOriginal += generated;
      else originalDue[day + bufferDays] = (originalDue[day + bufferDays] || 0) + generated;
    }

    const resolvedOriginal = Math.min(eligibleOriginal, cap);
    eligibleOriginal -= resolvedOriginal;
    const resolvedReopen = Math.min(eligibleReopen, Math.max(0, cap - resolvedOriginal));
    eligibleReopen -= resolvedReopen;
    const resolved = resolvedOriginal + resolvedReopen;
    backlog = Math.max(0, backlog - resolved);
    blocked = Math.max(0, Math.min(remaining, blocked - resolved * blockedPer));

    const reopened = resolvedOriginal * reopenFraction;
    if (reopened) {
      reopenPending += reopened;
      reopenDue[day + reopenDelay] = (reopenDue[day + reopenDelay] || 0) + reopened;
    }

    remaining = Math.max(0, remaining - executed);
    blocked = Math.min(remaining, blocked);

    cumulativeExecuted += executed;
    cumulativeGenerated += generated;
    cumulativeReopened += reopened;

    rows.push({
      day,
      executedCumulative: cumulativeExecuted,
      generatedCumulative: cumulativeGenerated,
      reopenedCumulative: cumulativeReopened,
      influxAddedToday: influxToday,
      issueWorkCumulative: cumulativeGenerated + cumulativeReopened + cumulativeInflux + cumulativeCalendar,
      backlog,
      blocked,
      remaining,
    });

    const clear =
      day >= gateDay &&
      remaining <= EPS &&
      backlog <= EPS &&
      eligibleOriginal <= EPS &&
      eligibleReopen <= EPS &&
      originalPending <= EPS &&
      reopenPending <= EPS;
    if (clear) {
      clearDay = day;
      break;
    }
  }

  trace.push({ day: clearDay, lever: 'core', note: 'Open-issue queue fully cleared', value: clearDay });

  return {
    rows,
    clearDay,
    capacityPerDay: cap,
    totalIssueWork: start + cumulativeGenerated + cumulativeReopened + cumulativeInflux + cumulativeCalendar,
    totalGenerated: cumulativeGenerated,
    totalReopened: cumulativeReopened,
    totalInflux: cumulativeInflux,
    totalCalendarDriven: cumulativeCalendar,
    trace,
  };
}

function rowAt(rows: SimulationRow[], day: number): SimulationRow {
  const first = rows[0];
  if (!first) throw new Error('SimulationResult.rows is unexpectedly empty');
  let best = first;
  for (const r of rows) {
    if (r.day <= day) best = r;
    else break;
  }
  return best;
}

export function rowAtDay(result: SimulationResult, day: number): SimulationRow {
  return rowAt(result.rows, day);
}

/**
 * Finds the minimum resolution FTE headcount (in 0.5 increments) that clears
 * the open-issue queue by `input.targetWorkday`, plus a sensitivity table
 * showing how the clear date moves as FTE count changes. Inverts the
 * capacity formula rather than searching a fixed calculator template.
 */
export function solveRequiredFtes(
  input: ScenarioInput,
  options: { minFtes?: number; maxFtes?: number; step?: number } = {}
): { recommendedFtes: number | null; sensitivity: FteSensitivityRow[] } {
  const min = options.minFtes ?? 0.5;
  const max = options.maxFtes ?? Math.max(min, input.levers.resolutionCapacity.fteCount * 3, 10);
  const step = options.step ?? 0.5;

  const sensitivity: FteSensitivityRow[] = [];
  let recommendedFtes: number | null = null;

  for (let ftes = min; ftes <= max + EPS; ftes += step) {
    const rounded = Math.round(ftes * 100) / 100;
    const scenario: ScenarioInput = {
      ...input,
      levers: {
        ...input.levers,
        resolutionCapacity: { ...input.levers.resolutionCapacity, enabled: true, fteCount: rounded },
      },
    };
    const result = runIssueBurnSimulation(scenario);
    const onTime = result.clearDay > 0 && result.clearDay <= input.targetWorkday;
    sensitivity.push({
      fteCount: rounded,
      capacityPerDay: result.capacityPerDay,
      clearDay: result.clearDay,
      onTime,
      daysLateOrEarly: result.clearDay > 0 ? result.clearDay - input.targetWorkday : Infinity,
    });
    if (onTime && recommendedFtes === null) recommendedFtes = rounded;
  }

  return { recommendedFtes, sensitivity };
}
