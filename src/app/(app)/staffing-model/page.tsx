import Link from 'next/link';
import { db } from '@/lib/db';

export default async function StaffingModelListPage() {
  const scenarios = await db.staffingScenario.findMany({
    include: { createdBy: true, versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
    orderBy: { updatedAt: 'desc' },
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, margin: 0 }}>Staffing Model</h1>
          <p style={{ color: 'var(--muted)', fontSize: 13, margin: '4px 0 0', maxWidth: 640 }}>
            Model test-execution and issue-resolution capacity to right-size an issue-resolution team against a
            target date. Standalone — a plan may optionally reference a project, but doesn&apos;t require one.
          </p>
        </div>
        <Link href="/staffing-model/new" className="btn btn-primary">
          + New plan
        </Link>
      </div>

      {scenarios.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
          No staffing plans yet. Create your first one to get started.
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <th style={{ padding: '10px 16px' }}>Plan</th>
                <th style={{ padding: '10px 16px' }}>Created by</th>
                <th style={{ padding: '10px 16px' }}>Latest version</th>
                <th style={{ padding: '10px 16px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {scenarios.map((s) => {
                const latest = s.versions[0];
                return (
                  <tr key={s.id} style={{ borderTop: '1px solid var(--line)' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <Link href={`/staffing-model/${s.id}`} style={{ fontWeight: 700, color: 'var(--ink)' }}>
                        {s.name}
                      </Link>
                    </td>
                    <td style={{ padding: '12px 16px' }}>{s.createdBy.name}</td>
                    <td style={{ padding: '12px 16px' }}>{latest ? `v${latest.versionNumber} — ${latest.label}` : '—'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span className="badge">{s.status}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
