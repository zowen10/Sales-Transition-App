'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

interface PlanVersionSummary {
  id: string; versionNumber: number; parentVersionId: string | null; scenarioName: string;
  status: string; recommended: boolean; totalHours: number; totalInvestment: number; calendarWeeks: number; peakWeeklyBurnHours: number; createdAt: string;
}

const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
const int = (n: number) => Math.round(n).toLocaleString('en-US');

export default function ScenariosPage({ params }: { params: { id: string } }) {
  const [versions, setVersions] = useState<PlanVersionSummary[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [scenarioName, setScenarioName] = useState('');
  const [parentId, setParentId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/transitions/${params.id}`);
    if (!res.ok) return;
    const t = await res.json();
    setVersions(t.planVersions);
    if (!parentId) {
      const recommended = t.planVersions.find((v: PlanVersionSummary) => v.recommended);
      setParentId(recommended?.id ?? t.planVersions[0]?.id ?? '');
    }
  }, [params.id, parentId]);

  useEffect(() => {
    load();
  }, [load]);

  async function createScenario(e: React.FormEvent) {
    e.preventDefault();
    if (!parentId) return;
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/plan-versions/${parentId}/scenarios`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ scenarioName }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Failed to create scenario.');
      return;
    }
    setShowForm(false);
    setScenarioName('');
    await load();
  }

  async function markRecommended(id: string) {
    await fetch(`/api/plan-versions/${id}/recommend`, { method: 'POST' });
    await load();
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 16, margin: 0 }}>Scenarios</h2>
          <p style={{ fontSize: 12, color: 'var(--muted)', margin: '4px 0 0' }}>
            Compare alternatives without overwriting the baseline. Mark one as recommended before submitting for review.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm((s) => !s)}>
          + New scenario
        </button>
      </div>

      {showForm && (
        <form onSubmit={createScenario} className="card" style={{ padding: 16, marginBottom: 16, display: 'grid', gap: 10, maxWidth: 480 }}>
          <div>
            <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Clone from</label>
            <select className="input" value={parentId} onChange={(e) => setParentId(e.target.value)}>
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.versionNumber} — {v.scenarioName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Scenario name</label>
            <input className="input" required value={scenarioName} onChange={(e) => setScenarioName(e.target.value)} placeholder="e.g. Accelerated schedule" />
          </div>
          {error && <div style={{ color: '#b42318', fontSize: 12 }}>{error}</div>}
          <div>
            <button className="btn btn-primary" disabled={submitting} type="submit">
              {submitting ? 'Creating…' : 'Create scenario'}
            </button>
          </div>
        </form>
      )}

      <div className="card" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--muted)', fontSize: 10, textTransform: 'uppercase' }}>
              <th style={{ padding: '10px 14px' }}>Version</th>
              <th style={{ padding: '10px 14px' }}>Status</th>
              <th style={{ padding: '10px 14px' }}>Hours</th>
              <th style={{ padding: '10px 14px' }}>Investment</th>
              <th style={{ padding: '10px 14px' }}>Weeks</th>
              <th style={{ padding: '10px 14px' }}>Peak burn</th>
              <th style={{ padding: '10px 14px' }}></th>
            </tr>
          </thead>
          <tbody>
            {versions.map((v) => (
              <tr key={v.id} style={{ borderTop: '1px solid var(--line)' }}>
                <td style={{ padding: '10px 14px', fontWeight: 700 }}>
                  v{v.versionNumber} — {v.scenarioName} {v.recommended && '★'}
                </td>
                <td style={{ padding: '10px 14px' }}>
                  <span className="badge">{v.status.replace(/_/g, ' ')}</span>
                </td>
                <td style={{ padding: '10px 14px' }}>{int(v.totalHours)}</td>
                <td style={{ padding: '10px 14px' }}>{money(v.totalInvestment)}</td>
                <td style={{ padding: '10px 14px' }}>{v.calendarWeeks}</td>
                <td style={{ padding: '10px 14px' }}>{int(v.peakWeeklyBurnHours)} hrs</td>
                <td style={{ padding: '10px 14px', display: 'flex', gap: 6 }}>
                  <Link className="btn" href={`/transitions/${params.id}/estimate?version=${v.id}`}>
                    View / edit
                  </Link>
                  {!v.recommended && (
                    <button className="btn" onClick={() => markRecommended(v.id)}>
                      Recommend
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
