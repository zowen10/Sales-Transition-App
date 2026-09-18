'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import LeverList from '@/components/LeverList';
import BurnChart from '@/components/BurnChart';
import ScenarioChatPanel from '@/components/ScenarioChatPanel';
import type { LeverConfig, SimulationResult, FteSensitivityRow } from '@/domain/staffingModel/types';
import type { DerivedLeverProposal } from '@/domain/issueAnalysis/deriveLevers';

interface ScenarioDetail {
  id: string;
  name: string;
  status: string;
  currentVersion: {
    id: string;
    versionNumber: number;
    label: string;
    leverConfig: LeverConfig;
    scenarioInput: { planStartDate: string; totalTestCases: number; startingIssues: number; targetWorkday: number };
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
  const [planStartDate, setPlanStartDate] = useState('');
  const [totalTestCases, setTotalTestCases] = useState(0);
  const [startingIssues, setStartingIssues] = useState(0);
  const [targetWorkday, setTargetWorkday] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [deriveProposal, setDeriveProposal] = useState<{ sourceBatches: { id: string; stageLabel: string | null; filename: string; rowCount: number }[]; proposal: DerivedLeverProposal } | null>(null);
  const [deriveError, setDeriveError] = useState<string | null>(null);
  const [deriving, setDeriving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/staffing-scenarios/${params.id}`);
    if (!res.ok) return;
    const body: ScenarioDetail = await res.json();
    setScenario(body);
    if (body.currentVersion) {
      setLevers(body.currentVersion.leverConfig);
      setPlanStartDate(body.currentVersion.scenarioInput.planStartDate);
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
        scenarioInput: { planStartDate, totalTestCases, startingIssues, targetWorkday, levers },
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

  async function deriveFromImports() {
    setDeriving(true);
    setDeriveError(null);
    const res = await fetch(`/api/staffing-scenarios/${params.id}/derive-levers`);
    setDeriving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setDeriveError(body.error ?? 'Failed to derive levers.');
      setDeriveProposal(null);
      return;
    }
    setDeriveProposal(await res.json());
  }

  function applyDerivedProposal() {
    if (!deriveProposal || !levers) return;
    const p = deriveProposal.proposal;
    setStartingIssues(p.startingIssues);
    setLevers({
      ...levers,
      calendarDrivenIssues: p.levers.calendarDrivenIssues,
      blockedCaseThrottling: { ...levers.blockedCaseThrottling, ...p.levers.blockedCaseThrottling },
      reopenRate: { ...levers.reopenRate, ...p.levers.reopenRate },
    });
    setDeriveProposal(null);
    setStatus('Derived values applied — click Recalculate to save this version.');
  }

  function applyChatProposal(patch: Partial<LeverConfig>) {
    if (!levers) return;
    setLevers({ ...levers, ...patch });
    setStatus('Chat-proposed change applied — click Recalculate to save this version.');
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
          <Link href={`/staffing-model/${params.id}/checkpoint`} className="btn">
            Load actuals
          </Link>
          <Link href={`/staffing-model/${params.id}/history`} className="btn">
            History
          </Link>
          <button type="button" className="btn" onClick={deriveFromImports} disabled={deriving}>
            {deriving ? 'Deriving…' : 'Derive from imports'}
          </button>
          <button type="button" className="btn btn-primary" onClick={recalculate} disabled={saving || !levers}>
            {saving ? 'Recalculating…' : 'Recalculate'}
          </button>
        </div>
      </div>

      {error && <div style={{ color: '#c0392b', fontSize: 12, marginBottom: 12 }}>{error}</div>}
      {deriveError && <div style={{ color: '#c0392b', fontSize: 12, marginBottom: 12 }}>{deriveError}</div>}

      {deriveProposal && levers && (
        <div className="card" style={{ padding: 16, marginBottom: 16, borderColor: 'var(--teal)' }}>
          <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 4 }}>Derived from imports</div>
          <div style={{ color: 'var(--muted)', fontSize: 11, marginBottom: 10 }}>
            Based on {deriveProposal.proposal.basedOnRecordCount} issues from{' '}
            {deriveProposal.sourceBatches.map((b) => b.stageLabel || b.filename).join(', ')}. Nothing is applied until
            you click Apply.
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 10 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--muted)', fontSize: 10, textTransform: 'uppercase' }}>
                <th style={{ padding: '6px 8px' }}>Field</th>
                <th style={{ padding: '6px 8px' }}>Current</th>
                <th style={{ padding: '6px 8px' }}>Proposed</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderTop: '1px solid var(--line)' }}>
                <td style={{ padding: '6px 8px' }}>Starting issues</td>
                <td style={{ padding: '6px 8px' }}>{startingIssues}</td>
                <td style={{ padding: '6px 8px', fontWeight: 800 }}>{deriveProposal.proposal.startingIssues}</td>
              </tr>
              <tr style={{ borderTop: '1px solid var(--line)' }}>
                <td style={{ padding: '6px 8px' }}>Calendar issue rate / day</td>
                <td style={{ padding: '6px 8px' }}>{levers.calendarDrivenIssues.enabled ? levers.calendarDrivenIssues.baseRatePerDay.toFixed(2) : 'off'}</td>
                <td style={{ padding: '6px 8px', fontWeight: 800 }}>{deriveProposal.proposal.levers.calendarDrivenIssues.baseRatePerDay.toFixed(2)}</td>
              </tr>
              <tr style={{ borderTop: '1px solid var(--line)' }}>
                <td style={{ padding: '6px 8px' }}>Blocked cases / issue</td>
                <td style={{ padding: '6px 8px' }}>{levers.blockedCaseThrottling.blockedCasesPerIssue.toFixed(2)}</td>
                <td style={{ padding: '6px 8px', fontWeight: 800 }}>{deriveProposal.proposal.levers.blockedCaseThrottling.blockedCasesPerIssue.toFixed(2)}</td>
              </tr>
              <tr style={{ borderTop: '1px solid var(--line)' }}>
                <td style={{ padding: '6px 8px' }}>Reopen %</td>
                <td style={{ padding: '6px 8px' }}>{levers.reopenRate.reopenRatePercent.toFixed(1)}</td>
                <td style={{ padding: '6px 8px', fontWeight: 800 }}>{deriveProposal.proposal.levers.reopenRate.reopenRatePercent.toFixed(1)}</td>
              </tr>
            </tbody>
          </table>
          <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 10 }}>
            {deriveProposal.proposal.trace.map((t) => (
              <div key={t.field}>
                {t.field}: {t.formula} → {t.value.toFixed(2)}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-primary" onClick={applyDerivedProposal}>
              Apply
            </button>
            <button type="button" className="btn" onClick={() => setDeriveProposal(null)}>
              Discard
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '280px minmax(0, 1fr) 300px', gap: 16, alignItems: 'start' }}>
        <aside className="card" style={{ padding: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 12 }}>Scenario basics</div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Plan start date</label>
            <input className="input" type="date" value={planStartDate} onChange={(e) => setPlanStartDate(e.target.value)} />
          </div>
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

        {levers && <ScenarioChatPanel scenarioId={params.id} currentLevers={levers} onApplyProposal={applyChatProposal} />}
      </div>
    </div>
  );
}
