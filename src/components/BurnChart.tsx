'use client';

interface SimulationRow {
  day: number;
  executedCumulative: number;
  issueWorkCumulative: number;
  backlog: number;
  influxAddedToday: number;
}

interface SimulationResultLike {
  rows: SimulationRow[];
  clearDay: number;
}

interface IssueInfluxEventLike {
  id: string;
  label: string;
  day: number;
  issueCount: number;
}

const int = (n: number) => Math.round(n).toLocaleString('en-US');

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

/**
 * Generalized port of the reference calculator's hand-rolled inline-SVG
 * chart (go_live_recovery_calculator_client.html `chartSvg`): cumulative
 * test cases executed (left axis) vs. cumulative issue work and open
 * backlog (right axis), with the target workday and any influx events
 * marked. No charting library — the repo has none, and this keeps parity
 * with the reference tool's approach.
 */
export default function BurnChart({
  result,
  targetWorkday,
  totalTestCases,
  totalIssueWork,
  influxEvents,
}: {
  result: SimulationResultLike;
  targetWorkday: number;
  totalTestCases: number;
  totalIssueWork: number;
  influxEvents: IssueInfluxEventLike[];
}) {
  const lastDay = Math.max(targetWorkday, result.clearDay || targetWorkday, ...influxEvents.map((e) => e.day), 5);
  const endDay = Math.max(5, Math.ceil(lastDay / 5) * 5);
  const step = Math.max(1, Math.round(endDay / 40));
  const points: SimulationRow[] = [];
  for (let d = 0; d <= endDay; d += step) points.push(rowAt(result.rows, d));
  if (points[points.length - 1]?.day !== endDay) points.push(rowAt(result.rows, endDay));

  const W = 920, H = 360, L = 60, R = 66, T = 40, B = 40;
  const plotW = W - L - R, plotH = H - T - B;
  const maxCases = Math.max(10, totalTestCases);
  const maxIssues = Math.max(10, totalIssueWork);
  const x = (d: number) => L + (d / endDay) * plotW;
  const yLeft = (v: number) => T + plotH - (v / maxCases) * plotH;
  const yRight = (v: number) => T + plotH - (v / maxIssues) * plotH;

  const path = (key: 'executedCumulative' | 'issueWorkCumulative' | 'backlog', scale: (v: number) => number) =>
    points.map((p, i) => `${i ? 'L' : 'M'} ${x(p.day).toFixed(1)} ${scale(p[key]).toFixed(1)}`).join(' ');

  const yTicks = [0, 0.25, 0.5, 0.75, 1];
  const xTarget = x(Math.min(endDay, targetWorkday));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Issue burn-down chart" style={{ width: '100%', height: 'auto', display: 'block' }}>
      <text x={L} y={20} fontSize={13} fontWeight={800} fill="var(--ink)">Test execution &amp; issue burn-down</text>
      {yTicks.map((v) => {
        const y = T + plotH - v * plotH;
        return (
          <g key={v}>
            <line x1={L} y1={y} x2={W - R} y2={y} stroke="var(--line)" strokeWidth={1} />
            <text x={L - 8} y={y + 4} fontSize={10} textAnchor="end" fill="var(--muted)">{int(maxCases * v)}</text>
            <text x={W - R + 8} y={y + 4} fontSize={10} fill="var(--muted)">{int(maxIssues * v)}</text>
          </g>
        );
      })}
      <line x1={L} y1={T} x2={L} y2={T + plotH} stroke="var(--muted)" strokeWidth={1} />
      <line x1={W - R} y1={T} x2={W - R} y2={T + plotH} stroke="var(--muted)" strokeWidth={1} />
      <line x1={L} y1={T + plotH} x2={W - R} y2={T + plotH} stroke="var(--muted)" strokeWidth={1} />
      <path d={path('executedCumulative', yLeft)} fill="none" stroke="#2e7dd6" strokeWidth={2.4} />
      <path d={path('issueWorkCumulative', yRight)} fill="none" stroke="#d69a2e" strokeWidth={2} strokeDasharray="6 4" />
      <path d={path('backlog', yRight)} fill="none" stroke="#d6522e" strokeWidth={2.4} />
      <line x1={xTarget} y1={T - 4} x2={xTarget} y2={T + plotH} stroke="#0f9d8f" strokeWidth={1.6} strokeDasharray="4 3" />
      <text x={xTarget} y={T - 8} fontSize={10} fontWeight={800} textAnchor="middle" fill="#0b7d72">Target</text>
      {influxEvents.map((ev) => {
        const evX = x(Math.min(endDay, ev.day));
        return (
          <g key={ev.id}>
            <line x1={evX} y1={T - 4} x2={evX} y2={T + plotH} stroke="#d69a2e" strokeWidth={1.2} strokeDasharray="2 3" />
            <text x={evX} y={T + plotH + 16} fontSize={9} textAnchor="middle" fill="var(--muted)">+{int(ev.issueCount)}</text>
          </g>
        );
      })}
      <g fontSize={10} fontWeight={700}>
        <rect x={L} y={T + plotH + 22} width={10} height={3} fill="#2e7dd6" />
        <text x={L + 14} y={T + plotH + 26} fill="var(--muted)">Cases executed (left)</text>
        <rect x={L + 170} y={T + plotH + 22} width={10} height={3} fill="#d69a2e" />
        <text x={L + 184} y={T + plotH + 26} fill="var(--muted)">Issue work (right)</text>
        <rect x={L + 320} y={T + plotH + 22} width={10} height={3} fill="#d6522e" />
        <text x={L + 334} y={T + plotH + 26} fill="var(--muted)">Open backlog (right)</text>
      </g>
    </svg>
  );
}
