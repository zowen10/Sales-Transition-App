'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { defaultLeverConfig } from '@/domain/staffingModel/defaults';

export default function NewStaffingScenarioPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [totalTestCases, setTotalTestCases] = useState(450);
  const [startingIssues, setStartingIssues] = useState(0);
  const [targetWorkday, setTargetWorkday] = useState(35);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!name.trim()) {
      setError('Give the plan a name.');
      return;
    }
    setLoading(true);
    setError(null);
    const res = await fetch('/api/staffing-scenarios', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name,
        label: 'Baseline',
        scenarioInput: { totalTestCases, startingIssues, targetWorkday, levers: defaultLeverConfig() },
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Failed to create plan.');
      return;
    }
    const body = await res.json();
    router.push(`/staffing-model/${body.scenarioId}`);
  }

  return (
    <div style={{ maxWidth: 520 }}>
      <h1 style={{ fontSize: 22, margin: '0 0 4px' }}>New staffing plan</h1>
      <p style={{ color: 'var(--muted)', fontSize: 13, margin: '0 0 16px' }}>
        Start with a few basics — every mechanic (issue generation, reopens, blocked cases, influx events, capacity)
        is adjustable once the plan is created.
      </p>
      <div className="card" style={{ padding: 20 }}>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--muted)', marginBottom: 4 }}>Plan name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rust-Oleum go-live recovery" />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--muted)', marginBottom: 4 }}>Total test cases</label>
          <input className="input" type="number" min={0} value={totalTestCases} onChange={(e) => setTotalTestCases(Number(e.target.value) || 0)} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--muted)', marginBottom: 4 }}>Starting issue backlog</label>
          <input className="input" type="number" min={0} value={startingIssues} onChange={(e) => setStartingIssues(Number(e.target.value) || 0)} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--muted)', marginBottom: 4 }}>Target workday (offset from plan start)</label>
          <input className="input" type="number" min={0} value={targetWorkday} onChange={(e) => setTargetWorkday(Number(e.target.value) || 0)} />
        </div>
        {error && <div style={{ color: '#c0392b', fontSize: 12, marginBottom: 12 }}>{error}</div>}
        <button type="button" className="btn btn-primary" onClick={create} disabled={loading}>
          {loading ? 'Creating…' : 'Create plan'}
        </button>
      </div>
    </div>
  );
}
