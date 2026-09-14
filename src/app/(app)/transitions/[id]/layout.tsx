import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { TransitionStepper } from '@/components/TransitionStepper';

export default async function TransitionLayout({ children, params }: { children: React.ReactNode; params: { id: string } }) {
  const transition = await db.transition.findUnique({
    where: { id: params.id },
    include: { client: true, planVersions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
  });
  if (!transition) notFound();

  const latestVersion = transition.planVersions[0];

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{transition.client.name}</div>
        <h1 style={{ fontSize: 22, margin: '2px 0 6px' }}>{transition.name}</h1>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12, color: 'var(--muted)' }}>
          <span>
            Status: <strong style={{ color: 'var(--ink)' }}>{transition.status.replace(/_/g, ' ')}</strong>
          </span>
          <span>
            Engagement Director: <strong style={{ color: 'var(--ink)' }}>{transition.engagementDirectorName}</strong>
          </span>
          {latestVersion && (
            <span>
              Latest plan version: <strong style={{ color: 'var(--ink)' }}>v{latestVersion.versionNumber} — {latestVersion.scenarioName} ({latestVersion.status.replace(/_/g, ' ')})</strong>
            </span>
          )}
          <span>Last saved: {new Date(transition.updatedAt).toLocaleString()}</span>
        </div>
      </div>
      <TransitionStepper transitionId={transition.id} />
      {children}
    </div>
  );
}
