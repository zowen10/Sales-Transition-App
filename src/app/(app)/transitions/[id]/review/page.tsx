'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

interface PlanVersionSummary {
  id: string; versionNumber: number; scenarioName: string; status: string; recommended: boolean;
  totalHours: number; totalInvestment: number; calendarWeeks: number; peakWeeklyBurnHours: number;
}

interface PlanVersionDetail {
  id: string; status: string; assumptions: { id: string; description: string }[]; risks: { id: string; description: string }[];
  decisions: { id: string; description: string }[]; approvals: { id: string; status: string; comment: string | null; approver: { id: string; name: string } }[];
  result: { totalInvestment: number; totalHours: number; calendarWeeks: number };
}

const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
const int = (n: number) => Math.round(n).toLocaleString('en-US');

export default function ReviewPage({ params }: { params: { id: string } }) {
  const { data: session } = useSession();
  const [versions, setVersions] = useState<PlanVersionSummary[]>([]);
  const [detail, setDetail] = useState<PlanVersionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [blockers, setBlockers] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/transitions/${params.id}`);
    if (!res.ok) return;
    const t = await res.json();
    setVersions(t.planVersions);
    const recommended = t.planVersions.find((v: PlanVersionSummary) => v.recommended) ?? t.planVersions[t.planVersions.length - 1];
    if (recommended) {
      const dRes = await fetch(`/api/plan-versions/${recommended.id}`);
      if (dRes.ok) setDetail(await dRes.json());
    }
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function submit() {
    if (!detail) return;
    setBusy(true);
    setError(null);
    setBlockers([]);
    const res = await fetch(`/api/plan-versions/${detail.id}/submit`, { method: 'POST' });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Failed to submit.');
      setBlockers(body.blockers ?? []);
      return;
    }
    await load();
  }

  async function decide(decision: 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED') {
    if (!detail) return;
    setBusy(true);
    setError(null);
    setBlockers([]);
    const res = await fetch(`/api/plan-versions/${detail.id}/approve`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ decision, comment }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Failed to record decision.');
      setBlockers(body.blockers ?? []);
      return;
    }
    setComment('');
    await load();
  }

  if (!detail) return <p style={{ color: 'var(--muted)' }}>No recommended plan yet — generate and recommend a scenario first.</p>;

  const summary = versions.find((v) => v.id === detail.id);
  const canSubmit = session?.user.roles.includes('TRANSITION_OWNER') || session?.user.roles.includes('ADMINISTRATOR');
  const canApprove = session?.user.roles.includes('EXECUTIVE_APPROVER') || session?.user.roles.includes('ADMINISTRATOR');
  const pendingForMe = detail.approvals.find((a) => a.status === 'PENDING' && a.approver.id === session?.user.id);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 16 }}>
      <div className="card" style={{ padding: 20 }}>
        <h2 style={{ fontSize: 15, margin: '0 0 4px' }}>Executive summary</h2>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>
          Recommended plan: v{summary?.versionNumber} — {summary?.scenarioName} · <span className="badge">{detail.status.replace(/_/g, ' ')}</span>
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 20 }}>
          <div className="card" style={{ padding: 12 }}>
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>Investment</div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>{money(detail.result.totalInvestment)}</div>
          </div>
          <div className="card" style={{ padding: 12 }}>
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>Hours</div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>{int(detail.result.totalHours)}</div>
          </div>
          <div className="card" style={{ padding: 12 }}>
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>Schedule</div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>{detail.result.calendarWeeks}w</div>
          </div>
        </div>

        <h3 style={{ fontSize: 13, margin: '0 0 8px' }}>Assumptions</h3>
        <ul style={{ fontSize: 12, marginBottom: 16 }}>
          {detail.assumptions.length ? detail.assumptions.map((a) => <li key={a.id}>{a.description}</li>) : <li style={{ color: 'var(--muted)' }}>None documented.</li>}
        </ul>
        <h3 style={{ fontSize: 13, margin: '0 0 8px' }}>Risks</h3>
        <ul style={{ fontSize: 12, marginBottom: 16 }}>
          {detail.risks.length ? detail.risks.map((r) => <li key={r.id}>{r.description}</li>) : <li style={{ color: 'var(--muted)' }}>None documented.</li>}
        </ul>
        <h3 style={{ fontSize: 13, margin: '0 0 8px' }}>Open decisions</h3>
        <ul style={{ fontSize: 12 }}>
          {detail.decisions.length ? detail.decisions.map((d) => <li key={d.id}>{d.description}</li>) : <li style={{ color: 'var(--muted)' }}>None documented.</li>}
        </ul>
      </div>

      <div className="card" style={{ padding: 20 }}>
        <h2 style={{ fontSize: 15, margin: '0 0 12px' }}>Approval</h2>

        {error && <div style={{ color: '#b42318', fontSize: 12, marginBottom: 10 }}>{error}</div>}
        {blockers.length > 0 && (
          <ul style={{ color: '#b42318', fontSize: 12, marginBottom: 10 }}>
            {blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        )}

        {detail.approvals.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            {detail.approvals.map((a) => (
              <div key={a.id} style={{ fontSize: 12, padding: '8px 0', borderTop: '1px solid var(--line)' }}>
                <strong>{a.approver.name}</strong> — <span className="badge">{a.status}</span>
                {a.comment && <div style={{ color: 'var(--muted)' }}>{a.comment}</div>}
              </div>
            ))}
          </div>
        )}

        {detail.status === 'DRAFT' || detail.status === 'IN_PROGRESS' || detail.status === 'CHANGES_REQUESTED' ? (
          canSubmit && (
            <button className="btn btn-primary" onClick={submit} disabled={busy}>
              Submit for review
            </button>
          )
        ) : detail.status === 'READY_FOR_REVIEW' && canApprove && pendingForMe ? (
          <div style={{ display: 'grid', gap: 8 }}>
            <textarea className="input" rows={2} placeholder="Comment (optional)" value={comment} onChange={(e) => setComment(e.target.value)} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={() => decide('APPROVED')} disabled={busy}>
                Approve
              </button>
              <button className="btn" onClick={() => decide('CHANGES_REQUESTED')} disabled={busy}>
                Request changes
              </button>
              <button className="btn" onClick={() => decide('REJECTED')} disabled={busy}>
                Reject
              </button>
            </div>
          </div>
        ) : detail.status === 'APPROVED' ? (
          <p style={{ fontSize: 13, color: 'var(--teal-dark)', fontWeight: 700 }}>✓ This plan is approved and locked.</p>
        ) : (
          <p style={{ fontSize: 12, color: 'var(--muted)' }}>Waiting on the assigned approver.</p>
        )}
      </div>
    </div>
  );
}
