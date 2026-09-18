'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { VarianceSummary } from '@/domain/staffingModel/types';

interface BatchSummary {
  id: string;
  filename: string;
  stageLabel: string | null;
  purpose: string;
  asOfDate: string | null;
  rowCount: number;
  mappingConfirmed: boolean;
}

const METRIC_LABELS: Record<string, string> = {
  executedCases: 'Test cases executed',
  openBacklog: 'Open issue backlog',
  resolvedIssuesCumulative: 'Issues resolved (cumulative)',
};

const STATUS_COLORS: Record<string, string> = { ahead: '#0b7d72', on_track: '#5b7480', behind: '#c0392b' };

export default function CheckpointPage({ params }: { params: { id: string } }) {
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [variance, setVariance] = useState<VarianceSummary | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/issue-imports?scenarioId=${params.id}`);
    if (!res.ok) return;
    const body = await res.json();
    const confirmed: BatchSummary[] = body.batches.filter((b: BatchSummary) => b.mappingConfirmed);
    setBatches(confirmed);
    const first = confirmed[0];
    if (first && !selectedId) {
      setSelectedId(first.id);
      if (first.asOfDate) setAsOfDate(first.asOfDate.slice(0, 10));
    }
  }, [params.id, selectedId]);

  useEffect(() => {
    load();
  }, [load]);

  async function runCheckpoint() {
    if (!selectedId) return;
    setLoading(true);
    setError(null);
    setVariance(null);
    const res = await fetch(`/api/staffing-scenarios/${params.id}/checkpoint`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actualsImportBatchId: selectedId, asOfDate }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Failed to record checkpoint.');
      return;
    }
    const body = await res.json();
    setVariance(body.variance);
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <h1 style={{ fontSize: 22, margin: '0 0 4px' }}>Load actuals</h1>
      <p style={{ color: 'var(--muted)', fontSize: 13, margin: '0 0 16px' }}>
        Compare a confirmed issue import against this plan&apos;s current forecast as of a date, and record the
        result as a new checkpoint in the plan&apos;s history. This never changes the forecast itself.
      </p>

      {batches.length === 0 ? (
        <div className="card" style={{ padding: 24, color: 'var(--muted)' }}>
          No mapping-confirmed issue imports exist for this plan yet.{' '}
          <Link href={`/staffing-model/${params.id}/import`}>Import one</Link> first.
        </div>
      ) : (
        <div className="card" style={{ padding: 20 }}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--muted)', marginBottom: 4 }}>Actuals import</label>
            <select className="input" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.stageLabel || b.filename} ({b.rowCount} rows)
                </option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--muted)', marginBottom: 4 }}>As-of date</label>
            <input className="input" type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} />
          </div>
          {error && <div style={{ color: '#c0392b', fontSize: 12, marginBottom: 12 }}>{error}</div>}
          <button type="button" className="btn btn-primary" onClick={runCheckpoint} disabled={loading}>
            {loading ? 'Comparing…' : 'Compare to forecast'}
          </button>
        </div>
      )}

      {variance && (
        <div className="card" style={{ padding: 20, marginTop: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 10 }}>Variance as of workday {variance.asOfDay}</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--muted)', fontSize: 10, textTransform: 'uppercase' }}>
                <th style={{ padding: '6px 8px' }}>Metric</th>
                <th style={{ padding: '6px 8px' }}>Forecast</th>
                <th style={{ padding: '6px 8px' }}>Actual</th>
                <th style={{ padding: '6px 8px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {variance.metrics.map((m) => (
                <tr key={m.metric} style={{ borderTop: '1px solid var(--line)' }}>
                  <td style={{ padding: '6px 8px' }}>{METRIC_LABELS[m.metric] ?? m.metric}</td>
                  <td style={{ padding: '6px 8px' }}>{Math.round(m.forecast * 10) / 10}</td>
                  <td style={{ padding: '6px 8px' }}>{Math.round(m.actual * 10) / 10}</td>
                  <td style={{ padding: '6px 8px', fontWeight: 800, color: STATUS_COLORS[m.status] }}>{m.status.replace('_', ' ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!variance.metrics.some((m) => m.metric === 'executedCases') && (
            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 8 }}>
              Test-case execution counts aren&apos;t tracked by an issue-list export, so that comparison is omitted
              rather than estimated.
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            <Link href={`/staffing-model/${params.id}/history`} className="btn">
              View plan history
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
