'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import LeverList from '@/components/LeverList';
import BurnChart from '@/components/BurnChart';
import type { LeverConfig, SimulationResult, FteSensitivityRow } from '@/domain/staffingModel/types';

interface ScenarioDetail {
  id: string;
  name: string;
  status: string;
  currentVersion: {
    id: string;
    versionNumber: number;
    label: string;
    leverConfig: LeverConfig;
    scenarioInput: { totalTestCases: number; startingIssues: number; targetWorkday: number };
    result: SimulationResult;
    checkpointDate: string | null;
  } | null;
  sensitivity: { recommendedFtes: number | null; sensitivity: FteSensitivityRow[] } | null;
  versions: { id: string; versionNumber: number; label: string; createdAt: string }[];
}

const int = (n: number) => Math.round(n).toLocaleString('en-US');

export default function StaffingScenarioWorkspace({ params }: { params: { id: string } }) {
  const [scenario, setScenario] = useState<ScenarioDetail | null>(null);
  const [levers, setLevers] = useState<LeverConfig | null>(null);
  const [totalTestCases, setTotalTestCases] = useState(0);
  const [startingIssues, setStartingIssues] = useState(0);
  const [targetWorkday, setTargetWorkday] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');

  const load = useCallback(async () => {
    const res = await fetch(`/api/staffing-scenarios/${params.id}`);
    if (!res.ok) return;
    const body: ScenarioDetail = await res.json();
    setScenario(body);
    if (body.currentVersion) {
      setLevers(body.currentVersion.leverConfig);
      setTotalTestCases(body.currentVersion.scenarioInput.totalTestCases);
      setStartingIssues(body.currentVersion.scenarioInput.startingIssues);
      setTargetWorkday(body.currentVersion.scenarioInput.targetWorkday);
    }
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function recalculate() {
    if (!levers) return;
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/staffing-scenarios/${params.id}/simulate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        label: scenario?.currentVersion?.label ?? 'Baseline',
        scenarioInput: { totalTestCases, startingIssues, targetWorkday, levers },
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Failed to recalculate.');
      return;
    }
    await load();
    setStatus(`Recalculated at ${new Date().toLocaleTimeString()}`);
  }

  if (!scenario) return <div style={{ color: 'var(--muted)' }}>Loading…</div>;

  const result = scenario.currentVersion?.result;
  const onTime = result ? result.clearDay > 0 && result.clearDay <= targetWorkday : false;
  const recommendedFtes = scenario.sensitivity?.recommendedFtes ?? null;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, margin: 0 }}>{scenario.name}</h1>
          <p style={{ color: 'var(--muted)', fontSize: 12, margin: '4px 0 0' }}>
            v{scenario.currentVersion?.versionNumber ?? 1} — {scenario.currentVersion?.label ?? 'Baseline'}
            {status ? ` · ${status}` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href={`/staffing-model/${params.id}/analysis`} className="btn">
            Issue analysis
          </Link>
          <button type="button" className="btn btn-primary" onClick={recalculate} disabled={saving || !levers}>
            {saving ? 'Recalculating…' : 'Recalculate'}
          </button>
        </div>
      </div>

      {error && <div style={{ color: '#c0392b', fontSize: 12, marginBottom: 12 }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '280px minmax(0, 1fr)', gap: 16, alignItems: 'start' }}>
        <aside className="card" style={{ padding: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 12 }}>Scenario basics</div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Total test cases</label>
            <input className="input" type="number" min={0} value={totalTestCases} onChange={(e) => setTotalTestCases(Number(e.target.value) || 0)} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Starting issue backlog</label>
            <input className="input" type="number" min={0} value={startingIssues} onChange={(e) => setStartingIssues(Number(e.target.value) || 0)} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Target workday</label>
            <input className="input" type="number" min={0} value={targetWorkday} onChange={(e) => setTargetWorkday(Number(e.target.value) || 0)} />
          </div>
          <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 12, borderTop: '1px solid var(--line)', paddingTop: 12 }}>Levers</div>
          {levers && <LeverList levers={levers} onChange={setLevers} />}
        </aside>

        <main>
          {result && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 10, marginBottom: 16 }}>
                <div className="card" style={{ padding: 12 }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 800 }}>Capacity</div>
                  <div style={{ fontSize: 20, fontWeight: 900 }}>{result.capacityPerDay}/day</div>
                </div>
                <div className="card" style={{ padding: 12 }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 800 }}>Total issue work</div>
                  <div style={{ fontSize: 20, fontWeight: 900 }}>{int(result.totalIssueWork)}</div>
                </div>
                <div className="card" style={{ padding: 12 }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 800 }}>Modeled clear day</div>
                  <div style={{ fontSize: 20, fontWeight: 900 }}>{result.clearDay || '—'}</div>
                </div>
                <div className="card" style={{ padding: 12 }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 800 }}>Status</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: onTime ? '#0b7d72' : '#c0392b' }}>{onTime ? 'On track' : 'Watch'}</div>
                </div>
              </div>

              <div className="card" style={{ padding: 16, marginBottom: 16 }}>
                <BurnChart
                  result={result}
                  targetWorkday={targetWorkday}
                  totalTestCases={totalTestCases}
                  totalIssueWork={result.totalIssueWork}
                  influxEvents={levers?.issueInfluxEvents.enabled ? levers.issueInfluxEvents.events : []}
                />
              </div>

              {scenario.sensitivity && (
                <div className="card" style={{ padding: 16 }}>
                  <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 4 }}>FTE sensitivity</div>
                  <div style={{ color: 'var(--muted)', fontSize: 11, marginBottom: 10 }}>
                    {recommendedFtes != null
                      ? `Recommended: ${recommendedFtes} FTEs to clear by workday ${targetWorkday}.`
                      : 'No modeled FTE count clears the queue by the target within the search range.'}
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ textAlign: 'left', color: 'var(--muted)', fontSize: 10, textTransform: 'uppercase' }}>
                        <th style={{ padding: '6px 8px' }}>FTEs</th>
                        <th style={{ padding: '6px 8px' }}>Capacity/day</th>
                        <th style={{ padding: '6px 8px' }}>Clear day</th>
                        <th style={{ padding: '6px 8px' }}>On time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scenario.sensitivity.sensitivity.map((row) => (
                        <tr
                          key={row.fteCount}
                          style={{ borderTop: '1px solid var(--line)', background: row.fteCount === recommendedFtes ? 'rgba(15,157,143,0.08)' : undefined }}
                        >
                          <td style={{ padding: '6px 8px', fontWeight: row.fteCount === recommendedFtes ? 800 : 400 }}>{row.fteCount}</td>
                          <td style={{ padding: '6px 8px' }}>{row.capacityPerDay}</td>
                          <td style={{ padding: '6px 8px' }}>{row.clearDay || '—'}</td>
                          <td style={{ padding: '6px 8px' }}>{row.onTime ? 'Yes' : 'No'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
