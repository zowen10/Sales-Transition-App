import Link from 'next/link';
import { db } from '@/lib/db';

export default async function TransitionOverviewPage({ params }: { params: { id: string } }) {
  const transition = await db.transition.findUnique({
    where: { id: params.id },
    include: {
      client: true,
      transitionOwner: true,
      salesLead: true,
      executiveSponsor: true,
      classification: true,
      planVersions: { orderBy: { versionNumber: 'desc' } },
    },
  });
  if (!transition) return null;

  const products: string[] = JSON.parse(transition.productsInScope);
  const currentPlan = transition.planVersions.find((v) => v.id === transition.currentPlanVersionId) ?? transition.planVersions[0];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
      <div className="card" style={{ padding: 20 }}>
        <h2 style={{ fontSize: 14, margin: '0 0 12px' }}>Engagement summary</h2>
        <dl style={{ display: 'grid', gridTemplateColumns: '160px 1fr', rowGap: 8, fontSize: 13 }}>
          <dt style={{ color: 'var(--muted)' }}>Client</dt>
          <dd>{transition.client.name}</dd>
          <dt style={{ color: 'var(--muted)' }}>Opportunity</dt>
          <dd>{transition.opportunityId ?? '—'}</dd>
          <dt style={{ color: 'var(--muted)' }}>Plan type</dt>
          <dd>{transition.planType.replace('_', ' ')}</dd>
          <dt style={{ color: 'var(--muted)' }}>Products in scope</dt>
          <dd>{products.join(', ') || '—'}</dd>
          <dt style={{ color: 'var(--muted)' }}>Transition owner</dt>
          <dd>{transition.transitionOwner.name}</dd>
          <dt style={{ color: 'var(--muted)' }}>Sales lead</dt>
          <dd>{transition.salesLead?.name ?? '—'}</dd>
          <dt style={{ color: 'var(--muted)' }}>Executive sponsor</dt>
          <dd>{transition.executiveSponsor?.name ?? '—'}</dd>
        </dl>

        <div style={{ marginTop: 20, display: 'flex', gap: 8 }}>
          <Link href={`/transitions/${transition.id}/intake`} className="btn btn-primary">
            Continue intake
          </Link>
          {currentPlan && (
            <Link href={`/transitions/${transition.id}/estimate`} className="btn">
              View estimate
            </Link>
          )}
        </div>
      </div>

      <div className="card" style={{ padding: 20 }}>
        <h2 style={{ fontSize: 14, margin: '0 0 12px' }}>Classification</h2>
        {transition.classification ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <span className="badge">{transition.classification.complexityLevel} complexity</span>
            <span className="badge">{transition.classification.timelinePressure} timeline pressure</span>
            <span className="badge">{transition.classification.confidenceLevel} confidence</span>
            <span className="badge">{transition.classification.commercialModel.replace(/_/g, ' ')}</span>
          </div>
        ) : (
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>Not yet classified — complete intake, then run classification.</p>
        )}

        <h2 style={{ fontSize: 14, margin: '20px 0 12px' }}>Plan versions</h2>
        {transition.planVersions.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>No plan generated yet.</p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
            {transition.planVersions.map((pv) => (
              <li key={pv.id} style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between' }}>
                <span>
                  v{pv.versionNumber} — {pv.scenarioName} {pv.recommended && '★'}
                </span>
                <span className="badge">{pv.status.replace(/_/g, ' ')}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
