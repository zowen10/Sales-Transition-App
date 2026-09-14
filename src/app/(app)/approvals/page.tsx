import Link from 'next/link';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';

export default async function ApprovalsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const approvals = await db.approval.findMany({
    where: { approverId: user.id, status: 'PENDING' },
    include: { planVersion: { include: { transition: { include: { client: true } } } } },
    orderBy: { requestedAt: 'desc' },
  });

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Approvals</h1>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>Plans awaiting your decision.</p>

      {approvals.length === 0 ? (
        <div className="card" style={{ padding: 30, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
          Nothing pending your approval.
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase' }}>
                <th style={{ padding: '10px 16px' }}>Project</th>
                <th style={{ padding: '10px 16px' }}>Client</th>
                <th style={{ padding: '10px 16px' }}>Plan version</th>
                <th style={{ padding: '10px 16px' }}>Requested</th>
                <th style={{ padding: '10px 16px' }}></th>
              </tr>
            </thead>
            <tbody>
              {approvals.map((a) => (
                <tr key={a.id} style={{ borderTop: '1px solid var(--line)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 700 }}>{a.planVersion.transition.name}</td>
                  <td style={{ padding: '12px 16px' }}>{a.planVersion.transition.client.name}</td>
                  <td style={{ padding: '12px 16px' }}>
                    v{a.planVersion.versionNumber} — {a.planVersion.scenarioName}
                  </td>
                  <td style={{ padding: '12px 16px' }}>{new Date(a.requestedAt).toLocaleDateString()}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <Link className="btn btn-primary" href={`/transitions/${a.planVersion.transitionId}/review`}>
                      Review
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
