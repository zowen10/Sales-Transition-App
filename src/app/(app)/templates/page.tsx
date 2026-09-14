import { db } from '@/lib/db';

const STATUS_COLOR: Record<string, string> = { DRAFT: '#5b7480', REVIEW: '#a15c00', PUBLISHED: '#0b7d72', RETIRED: '#8a8f94' };

export default async function TemplatesPage() {
  const templates = await db.template.findMany({
    include: { owner: { select: { name: true } } },
    orderBy: [{ templateFamilyId: 'asc' }, { version: 'desc' }],
  });

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Templates</h1>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
        Plan templates, question sets, estimation rules, and other governed assets. Only Published templates drive new plan
        generation.
      </p>

      <div className="card" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase' }}>
              <th style={{ padding: '10px 16px' }}>Name</th>
              <th style={{ padding: '10px 16px' }}>Type</th>
              <th style={{ padding: '10px 16px' }}>Owner</th>
              <th style={{ padding: '10px 16px' }}>Version</th>
              <th style={{ padding: '10px 16px' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((t) => (
              <tr key={t.id} style={{ borderTop: '1px solid var(--line)' }}>
                <td style={{ padding: '12px 16px', fontWeight: 700 }}>{t.name}</td>
                <td style={{ padding: '12px 16px' }}>{t.type.replace(/_/g, ' ')}</td>
                <td style={{ padding: '12px 16px' }}>{t.owner.name}</td>
                <td style={{ padding: '12px 16px' }}>v{t.version}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span className="badge" style={{ color: STATUS_COLOR[t.status], borderColor: STATUS_COLOR[t.status] }}>
                    {t.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
