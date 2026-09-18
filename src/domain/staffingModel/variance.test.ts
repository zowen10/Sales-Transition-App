import { describe, expect, it } from 'vitest';
import { compareForecastToActuals } from './variance';
import { runIssueBurnSimulation } from './engine';
import { referenceScenarioInput } from './fixtures/referenceCalculatorBaseline';

describe('compareForecastToActuals', () => {
  const forecast = runIssueBurnSimulation(referenceScenarioInput());

  it('omits the executedCases metric when actuals do not carry it (issue-only import)', () => {
    const variance = compareForecastToActuals(forecast, { asOfDay: 10, openBacklog: 5, resolvedIssuesCumulative: 20 });
    expect(variance.metrics.some((m) => m.metric === 'executedCases')).toBe(false);
    expect(variance.metrics.map((m) => m.metric)).toEqual(['openBacklog', 'resolvedIssuesCumulative']);
  });

  it('includes executedCases when actuals do carry it', () => {
    const variance = compareForecastToActuals(forecast, { asOfDay: 10, executedCases: 200, openBacklog: 5, resolvedIssuesCumulative: 20 });
    expect(variance.metrics.map((m) => m.metric)).toContain('executedCases');
  });

  it('flags a lower-than-forecast open backlog as ahead, not behind', () => {
    const forecastRow = forecast.rows.find((r) => r.day === 10)!;
    const variance = compareForecastToActuals(forecast, {
      asOfDay: 10,
      openBacklog: Math.max(0, forecastRow.backlog - 100),
      resolvedIssuesCumulative: forecastRow.issueWorkCumulative,
    });
    const backlogMetric = variance.metrics.find((m) => m.metric === 'openBacklog');
    expect(backlogMetric?.status).toBe('ahead');
  });

  it('flags a higher-than-forecast open backlog as behind', () => {
    const forecastRow = forecast.rows.find((r) => r.day === 10)!;
    const variance = compareForecastToActuals(forecast, {
      asOfDay: 10,
      openBacklog: forecastRow.backlog + 100,
      resolvedIssuesCumulative: forecastRow.issueWorkCumulative,
    });
    const backlogMetric = variance.metrics.find((m) => m.metric === 'openBacklog');
    expect(backlogMetric?.status).toBe('behind');
  });
});
