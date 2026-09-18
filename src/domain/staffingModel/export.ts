import ExcelJS from 'exceljs';
import type { FteSensitivityRow, LeverConfig, ScenarioInput, SimulationResult } from './types';

export interface StaffingExportContext {
  scenarioName: string;
  versionLabel: string;
  versionNumber: number;
  generatedAt: string;
  scenarioInput: Omit<ScenarioInput, 'levers'>;
  levers: LeverConfig;
  result: SimulationResult;
  sensitivity: FteSensitivityRow[];
  recommendedFtes: number | null;
}

const int = (n: number) => Math.round(n);
const fmt1 = (n: number) => Number(n.toFixed(1));

/**
 * Builds the staffing plan's export workbook straight from a stored
 * SimulationResult/LeverConfig — nothing is recalculated here, mirroring
 * buildBurnPlanWorkbook's "the workbook only formats what the engine
 * already produced" convention.
 */
export function buildStaffingWorkbook(ctx: StaffingExportContext): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sales Transition App';
  wb.created = new Date(ctx.generatedAt);

  const onTime = ctx.result.clearDay > 0 && ctx.result.clearDay <= ctx.scenarioInput.targetWorkday;

  const summary = wb.addWorksheet('Summary');
  summary.columns = [{ width: 32 }, { width: 28 }];
  summary.addRows([
    ['Plan', ctx.scenarioName],
    ['Version', `v${ctx.versionNumber} — ${ctx.versionLabel}`],
    ['Generated', ctx.generatedAt],
    ['Plan start date', ctx.scenarioInput.planStartDate],
    [],
    ['Total test cases', ctx.scenarioInput.totalTestCases],
    ['Starting issue backlog', ctx.scenarioInput.startingIssues],
    ['Target workday', ctx.scenarioInput.targetWorkday],
    [],
    ['Resolution capacity (issues/day)', ctx.result.capacityPerDay],
    ['Total issue work', fmt1(ctx.result.totalIssueWork)],
    ['Modeled clear day', ctx.result.clearDay || 'Never clears within horizon'],
    ['Status', onTime ? 'On track' : 'Watch'],
    ['Recommended FTEs', ctx.recommendedFtes ?? 'None found in search range'],
  ]);

  const leversSheet = wb.addWorksheet('Levers');
  leversSheet.columns = [
    { header: 'Lever', key: 'lever', width: 26 },
    { header: 'Enabled', key: 'enabled', width: 10 },
    { header: 'Parameters', key: 'params', width: 60 },
  ];
  for (const [key, value] of Object.entries(ctx.levers)) {
    const { enabled, ...params } = value as { enabled: boolean } & Record<string, unknown>;
    leversSheet.addRow({ lever: key, enabled: enabled ? 'Yes' : 'No', params: JSON.stringify(params) });
  }

  const burnSheet = wb.addWorksheet('Daily Burn');
  burnSheet.columns = [
    { header: 'Workday', key: 'day', width: 10 },
    { header: 'Cases Executed (cum.)', key: 'executed', width: 20 },
    { header: 'Issue Work (cum.)', key: 'issueWork', width: 18 },
    { header: 'Open Backlog', key: 'backlog', width: 14 },
    { header: 'Blocked Cases', key: 'blocked', width: 14 },
    { header: 'Cases Remaining', key: 'remaining', width: 16 },
  ];
  ctx.result.rows.forEach((r) =>
    burnSheet.addRow({
      day: r.day,
      executed: fmt1(r.executedCumulative),
      issueWork: fmt1(r.issueWorkCumulative),
      backlog: fmt1(r.backlog),
      blocked: fmt1(r.blocked),
      remaining: fmt1(r.remaining),
    })
  );

  const sensitivitySheet = wb.addWorksheet('FTE Sensitivity');
  sensitivitySheet.columns = [
    { header: 'FTEs', key: 'ftes', width: 10 },
    { header: 'Capacity/Day', key: 'capacity', width: 14 },
    { header: 'Clear Day', key: 'clearDay', width: 12 },
    { header: 'On Time', key: 'onTime', width: 10 },
  ];
  ctx.sensitivity.forEach((row) =>
    sensitivitySheet.addRow({
      ftes: row.fteCount,
      capacity: row.capacityPerDay,
      clearDay: row.clearDay || '—',
      onTime: row.onTime ? 'Yes' : 'No',
    })
  );

  return wb;
}

export function buildStaffingMarkdownSummary(ctx: StaffingExportContext): string {
  const onTime = ctx.result.clearDay > 0 && ctx.result.clearDay <= ctx.scenarioInput.targetWorkday;
  const enabledLevers = Object.entries(ctx.levers)
    .filter(([, v]) => (v as { enabled: boolean }).enabled)
    .map(([k]) => k);

  return `# Staffing Plan Summary — ${ctx.scenarioName}

Version v${ctx.versionNumber} — ${ctx.versionLabel} · Generated ${ctx.generatedAt}

## Scenario
- **Plan start date:** ${ctx.scenarioInput.planStartDate}
- **Total test cases:** ${int(ctx.scenarioInput.totalTestCases)}
- **Starting issue backlog:** ${int(ctx.scenarioInput.startingIssues)}
- **Target workday:** ${ctx.scenarioInput.targetWorkday}

## Result
- **Resolution capacity:** ${ctx.result.capacityPerDay} issues/day
- **Total issue work:** ${fmt1(ctx.result.totalIssueWork)}
- **Modeled clear day:** ${ctx.result.clearDay || 'Never clears within the modeled horizon'}
- **Status:** ${onTime ? 'On track' : 'Watch'}
- **Recommended FTEs to hit target:** ${ctx.recommendedFtes ?? 'None found in the search range'}

## Active levers
${enabledLevers.length ? enabledLevers.map((l) => `- ${l}`).join('\n') : '- None enabled.'}

## FTE sensitivity
| FTEs | Capacity/day | Clear day | On time |
|---|---|---|---|
${ctx.sensitivity.map((r) => `| ${r.fteCount} | ${r.capacityPerDay} | ${r.clearDay || '—'} | ${r.onTime ? 'Yes' : 'No'} |`).join('\n')}
`;
}
