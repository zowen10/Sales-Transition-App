import { rowAtDay } from './engine';
import type { ActualsSnapshot, SimulationResult, VarianceMetric, VarianceSummary } from './types';

const ON_TRACK_TOLERANCE = 0.05; // 5% of the forecast value

function statusFor(forecast: number, actual: number, higherIsBetter: boolean): VarianceMetric['status'] {
  const tolerance = Math.max(1, Math.abs(forecast) * ON_TRACK_TOLERANCE);
  if (Math.abs(actual - forecast) <= tolerance) return 'on_track';
  const aheadOfForecast = higherIsBetter ? actual > forecast : actual < forecast;
  return aheadOfForecast ? 'ahead' : 'behind';
}

/**
 * Compares a plan's forecast (its stored SimulationResult) against real
 * observed data as of a checkpoint day, producing the explicit,
 * human-reviewable VarianceSummary that gets attached to the next
 * StaffingScenarioVersion when a PM loads actuals into an existing plan.
 * Never mutates the forecast — the plan's next version, if any, is a
 * deliberate human decision, not something this function applies itself.
 */
export function compareForecastToActuals(forecast: SimulationResult, actuals: ActualsSnapshot): VarianceSummary {
  const forecastRow = rowAtDay(forecast, actuals.asOfDay);

  const metrics: VarianceMetric[] = [
    {
      metric: 'executedCases',
      forecast: forecastRow.executedCumulative,
      actual: actuals.executedCases,
      delta: actuals.executedCases - forecastRow.executedCumulative,
      status: statusFor(forecastRow.executedCumulative, actuals.executedCases, true),
    },
    {
      metric: 'openBacklog',
      forecast: forecastRow.backlog,
      actual: actuals.openBacklog,
      delta: actuals.openBacklog - forecastRow.backlog,
      // Lower backlog than forecast is better, so invert the comparison.
      status: statusFor(forecastRow.backlog, actuals.openBacklog, false),
    },
    {
      metric: 'resolvedIssuesCumulative',
      forecast: forecastRow.issueWorkCumulative,
      actual: actuals.resolvedIssuesCumulative,
      delta: actuals.resolvedIssuesCumulative - forecastRow.issueWorkCumulative,
      status: statusFor(forecastRow.issueWorkCumulative, actuals.resolvedIssuesCumulative, true),
    },
  ];

  return { asOfDay: actuals.asOfDay, metrics };
}
