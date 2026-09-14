import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user || !user.roles.includes('ADMINISTRATOR')) redirect('/transitions');

  const [userCount, transitionCount, templateCount, auditCount] = await Promise.all([
    db.user.count(),
    db.transition.count(),
    db.template.count(),
    db.auditEvent.count(),
  ]);

  const recentAudit = await db.auditEvent.findMany({
    include: { actor: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Administration</h1>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
        PSO / Services Tooling administration: configuration, permissions, and audit trail.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 20 }}>
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: 10, color: 'var(--muted)' }}>Users</div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{userCount}</div>
        </div>
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: 10, color: 'var(--muted)' }}>Projects</div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{transitionCount}</div>
        </div>
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: 10, color: 'var(--muted)' }}>Templates</div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{templateCount}</div>
        </div>
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: 10, color: 'var(--muted)' }}>Audit events</div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{auditCount}</div>
        </div>
      </div>

      <h2 style={{ fontSize: 14, marginBottom: 10 }}>Recent audit trail</h2>
      <div className="card" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--muted)', fontSize: 10, textTransform: 'uppercase' }}>
              <th style={{ padding: '8px 14px' }}>When</th>
              <th style={{ padding: '8px 14px' }}>Actor</th>
              <th style={{ padding: '8px 14px' }}>Action</th>
              <th style={{ padding: '8px 14px' }}>Entity</th>
            </tr>
          </thead>
          <tbody>
            {recentAudit.map((e) => (
              <tr key={e.id} style={{ borderTop: '1px solid var(--line)' }}>
                <td style={{ padding: '8px 14px' }}>{new Date(e.createdAt).toLocaleString()}</td>
                <td style={{ padding: '8px 14px' }}>{e.actor.name}</td>
                <td style={{ padding: '8px 14px' }}>{e.action}</td>
                <td style={{ padding: '8px 14px' }}>
                  {e.entityType} · {e.entityId.slice(0, 8)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
