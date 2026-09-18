'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

interface BatchSummary {
  id: string;
  filename: string;
  stageLabel: string | null;
  purpose: string;
  rowCount: number;
  decision: 'include' | 'exclude' | 'needs_review';
  pmNote: string | null;
  expectedUplift: { reason: string; effectiveFrom: number; adjustment: number } | null;
  mappingConfirmed: boolean;
  uploadedByName: string;
  uploadedAt: string;
}

interface AnalysisResult {
  rowCount: number;
  issueTypeBreakdown: { issueType: string; count: number; percentOfTotal: number }[];
  arrivalRate: { date: string; createdCount: number; resolvedCount: number }[];
  turnaroundTime: { issueType: string; sampleSize: number; medianDays: number; p90Days: number }[];
  reopenRate: { resolvedCount: number; reopenedCount: number; reopenRatePercent: number };
  blockedCaseImpact: { openIssueCount: number; totalBlockedTestCases: number; averageBlockedPerOpenIssue: number };
}

const num = (n: number) => Math.round(n * 10) / 10;

export default function IssueAnalysisPage({ params }: { params: { id: string } }) {
  const searchParams = useSearchParams();
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('batch'));
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [upliftDraft, setUpliftDraft] = useState<{ reason: string; effectiveFrom: number; adjustment: number }>({
    reason: '',
    effectiveFrom: 0,
    adjustment: 0,
  });

  const loadBatches = useCallback(async () => {
    const res = await fetch(`/api/issue-imports?scenarioId=${params.id}`);
    if (!res.ok) return;
    const body = await res.json();
    setBatches(body.batches);
    if (!selectedId && body.batches.length) setSelectedId(body.batches[0].id);
  }, [params.id, selectedId]);

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  const loadAnalysis = useCallback(async (batchId: string) => {
    setAnalysis(null);
    setAnalysisError(null);
    const res = await fetch(`/api/issue-imports/${batchId}/analysis`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setAnalysisError(body.error ?? 'Failed to load analysis.');
      return;
    }
    setAnalysis(await res.json());
  }, []);

  useEffect(() => {
    if (selectedId) loadAnalysis(selectedId);
  }, [selectedId, loadAnalysis]);

  const selectedBatch = batches.find((b) => b.id === selectedId) ?? null;

  async function updateDecision(patch: Partial<{ decision: BatchSummary['decision']; pmNote: string; expectedUplift: BatchSummary['expectedUplift'] }>) {
    if (!selectedId) return;
    await fetch(`/api/issue-imports/${selectedId}/decision`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    });
    await loadBatches();
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, margin: 0 }}>Issue-list analysis</h1>
          <p style={{ color: 'var(--muted)', fontSize: 12, margin: '4px 0 0' }}>
            Multiple imports from different project stages may exist — choose which ones inform the plan.
          </p>
        </div>
        <Link href={`/staffing-model/${params.id}/import`} className="btn btn-primary">
          + Import issue list
        </Link>
      </div>

      {batches.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
          No issue lists imported yet for this plan.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '260px minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
          <div className="card" style={{ padding: 12 }}>
            {batches.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setSelectedId(b.id)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  border: 'none',
                  background: b.id === selectedId ? 'rgba(15,157,143,0.1)' : 'transparent',
                  borderRadius: 8,
                  padding: 10,
                  marginBottom: 4,
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 12 }}>{b.stageLabel || b.filename}</div>
                <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                  {b.rowCount} rows · {b.purpose === 'actuals_checkpoint' ? 'actuals' : 'baseline'} ·{' '}
                  <span className="badge">{b.decision}</span>
                </div>
              </button>
            ))}
          </div>

          <div>
            {selectedBatch && !selectedBatch.mappingConfirmed && (
              <div className="card" style={{ padding: 16, marginBottom: 16, color: 'var(--muted)' }}>
                Column mapping hasn&apos;t been confirmed for this import yet.{' '}
                <Link href={`/staffing-model/${params.id}/import`}>Import again</Link> to complete the mapping stage
                gate.
              </div>
            )}

            {selectedBatch && (
              <div className="card" style={{ padding: 16, marginBottom: 16 }}>
                <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 10 }}>Selectivity</div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  {(['include', 'exclude', 'needs_review'] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      className="btn"
                      style={selectedBatch.decision === d ? { borderColor: 'var(--teal)', color: 'var(--teal-dark)' } : undefined}
                      onClick={() => updateDecision({ decision: d })}
                    >
                      {d}
                    </button>
                  ))}
                </div>
                <textarea
                  className="input"
                  placeholder="PM note (e.g. why this batch is excluded)"
                  defaultValue={selectedBatch.pmNote ?? ''}
                  onBlur={(e) => updateDecision({ pmNote: e.target.value })}
                  style={{ minHeight: 60, marginBottom: 10 }}
                />
                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', marginBottom: 6 }}>
                  Expected uplift (optional — e.g. &quot;UAT typically runs ~2x SIT&apos;s issue rate&quot;)
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    className="input"
                    placeholder="Reason"
                    value={upliftDraft.reason}
                    onChange={(e) => setUpliftDraft({ ...upliftDraft, reason: e.target.value })}
                    style={{ flex: 1 }}
                  />
                  <input
                    className="input"
                    type="number"
                    placeholder="From day"
                    value={upliftDraft.effectiveFrom}
                    onChange={(e) => setUpliftDraft({ ...upliftDraft, effectiveFrom: Number(e.target.value) || 0 })}
                    style={{ width: 90 }}
                  />
                  <input
                    className="input"
                    type="number"
                    placeholder="Adjustment"
                    value={upliftDraft.adjustment}
                    onChange={(e) => setUpliftDraft({ ...upliftDraft, adjustment: Number(e.target.value) || 0 })}
                    style={{ width: 100 }}
                  />
                  <button
                    type="button"
                    className="btn"
                    onClick={() => upliftDraft.reason.trim() && updateDecision({ expectedUplift: upliftDraft })}
                  >
                    Save
                  </button>
                </div>
                {selectedBatch.expectedUplift && (
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
                    Current: {selectedBatch.expectedUplift.reason} (from day {selectedBatch.expectedUplift.effectiveFrom}, adjustment{' '}
                    {selectedBatch.expectedUplift.adjustment})
                  </div>
                )}
              </div>
            )}

            {analysisError && <div className="card" style={{ padding: 16, color: '#c0392b' }}>{analysisError}</div>}

            {analysis && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 10, marginBottom: 16 }}>
                  <div className="card" style={{ padding: 12 }}>
                    <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 800 }}>Rows</div>
                    <div style={{ fontSize: 20, fontWeight: 900 }}>{analysis.rowCount}</div>
                  </div>
                  <div className="card" style={{ padding: 12 }}>
                    <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 800 }}>Reopen rate</div>
                    <div style={{ fontSize: 20, fontWeight: 900 }}>{num(analysis.reopenRate.reopenRatePercent)}%</div>
                  </div>
                  <div className="card" style={{ padding: 12 }}>
                    <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 800 }}>Avg blocked / open issue</div>
                    <div style={{ fontSize: 20, fontWeight: 900 }}>{num(analysis.blockedCaseImpact.averageBlockedPerOpenIssue)}</div>
                  </div>
                </div>

                <div className="card" style={{ padding: 16, marginBottom: 16 }}>
                  <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 10 }}>Issue type mix</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <tbody>
                      {analysis.issueTypeBreakdown.map((row) => (
                        <tr key={row.issueType} style={{ borderTop: '1px solid var(--line)' }}>
                          <td style={{ padding: '6px 8px' }}>{row.issueType}</td>
                          <td style={{ padding: '6px 8px' }}>{row.count}</td>
                          <td style={{ padding: '6px 8px', color: 'var(--muted)' }}>{num(row.percentOfTotal)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="card" style={{ padding: 16 }}>
                  <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 10 }}>Turnaround time by issue type</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ textAlign: 'left', color: 'var(--muted)', fontSize: 10, textTransform: 'uppercase' }}>
                        <th style={{ padding: '6px 8px' }}>Type</th>
                        <th style={{ padding: '6px 8px' }}>Sample</th>
                        <th style={{ padding: '6px 8px' }}>Median days</th>
                        <th style={{ padding: '6px 8px' }}>P90 days</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.turnaroundTime.map((row) => (
                        <tr key={row.issueType} style={{ borderTop: '1px solid var(--line)' }}>
                          <td style={{ padding: '6px 8px' }}>{row.issueType}</td>
                          <td style={{ padding: '6px 8px' }}>{row.sampleSize}</td>
                          <td style={{ padding: '6px 8px' }}>{num(row.medianDays)}</td>
                          <td style={{ padding: '6px 8px' }}>{num(row.p90Days)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
