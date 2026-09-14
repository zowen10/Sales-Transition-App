import Link from 'next/link';
import { db } from '@/lib/db';

const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#5b7480',
  INTAKE_IN_PROGRESS: '#8a6d3b',
  CLASSIFIED: '#0f6ea8',
  PLAN_IN_PROGRESS: '#0f6ea8',
  READY_FOR_REVIEW: '#a15c00',
  APPROVED: '#0b7d72',
  MOBILIZING: '#0b7d72',
  ARCHIVED: '#8a8f94',
};

export default async function TransitionsPage() {
  const transitions = await db.transition.findMany({
    include: { client: true, transitionOwner: true, executiveSponsor: true },
    orderBy: { updatedAt: 'desc' },
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, margin: 0 }}>Projects</h1>
          <p style={{ color: 'var(--muted)', fontSize: 13, margin: '4px 0 0' }}>
            Every project is visible to every signed-in user. Guide each one from opportunity handoff to an approved
            delivery plan.
          </p>
        </div>
        <Link href="/transitions/new" className="btn btn-primary">
          + New Project
        </Link>
      </div>

      {transitions.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
          No projects yet. Create your first one to get started.
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <th style={{ padding: '10px 16px' }}>Project</th>
                <th style={{ padding: '10px 16px' }}>Client</th>
                <th style={{ padding: '10px 16px' }}>Plan type</th>
                <th style={{ padding: '10px 16px' }}>Owner</th>
                <th style={{ padding: '10px 16px' }}>Sponsor</th>
                <th style={{ padding: '10px 16px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {transitions.map((t) => (
                <tr key={t.id} style={{ borderTop: '1px solid var(--line)' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <Link href={`/transitions/${t.id}`} style={{ fontWeight: 700, color: 'var(--ink)' }}>
                      {t.name}
                    </Link>
                  </td>
                  <td style={{ padding: '12px 16px' }}>{t.client.name}</td>
                  <td style={{ padding: '12px 16px' }}>{t.planType.replace('_', ' ')}</td>
                  <td style={{ padding: '12px 16px' }}>{t.transitionOwner.name}</td>
                  <td style={{ padding: '12px 16px' }}>{t.executiveSponsor?.name ?? '—'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span className="badge" style={{ color: STATUS_COLORS[t.status], borderColor: STATUS_COLORS[t.status] }}>
                      {t.status.replace(/_/g, ' ')}
                    </span>
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
