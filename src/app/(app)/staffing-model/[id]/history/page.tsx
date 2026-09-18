'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { VarianceSummary } from '@/domain/staffingModel/types';

interface VersionSummary {
  id: string;
  versionNumber: number;
  label: string;
  parentVersionId: string | null;
  checkpointDate: string | null;
  varianceSummary: VarianceSummary | null;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = { ahead: '#0b7d72', on_track: '#5b7480', behind: '#c0392b' };

export default function StaffingScenarioHistoryPage({ params }: { params: { id: string } }) {
  const [name, setName] = useState('');
  const [versions, setVersions] = useState<VersionSummary[]>([]);

  useEffect(() => {
    fetch(`/api/staffing-scenarios/${params.id}`)
      .then((res) => res.json())
      .then((body) => {
        setName(body.name);
        setVersions([...body.versions].sort((a: VersionSummary, b: VersionSummary) => a.versionNumber - b.versionNumber));
      });
  }, [params.id]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, margin: 0 }}>{name} — history</h1>
          <p style={{ color: 'var(--muted)', fontSize: 12, margin: '4px 0 0' }}>
            Every revision of this plan, whether from a manual edit or a checkpoint against actuals.
          </p>
        </div>
        <Link href={`/staffing-model/${params.id}`} className="btn btn-primary">
          Back to plan
        </Link>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase' }}>
              <th style={{ padding: '10px 16px' }}>Version</th>
              <th style={{ padding: '10px 16px' }}>Type</th>
              <th style={{ padding: '10px 16px' }}>Created</th>
              <th style={{ padding: '10px 16px' }}>Variance at checkpoint</th>
            </tr>
          </thead>
          <tbody>
            {versions.map((v) => (
              <tr key={v.id} style={{ borderTop: '1px solid var(--line)' }}>
                <td style={{ padding: '12px 16px', fontWeight: 700 }}>
                  v{v.versionNumber} — {v.label}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span className="badge">{v.checkpointDate ? 'checkpoint' : v.parentVersionId ? 'edit' : 'baseline'}</span>
                </td>
                <td style={{ padding: '12px 16px', color: 'var(--muted)' }}>
                  {v.checkpointDate ? `as of ${v.checkpointDate.slice(0, 10)}` : new Date(v.createdAt).toLocaleString()}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  {v.varianceSummary ? (
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      {v.varianceSummary.metrics.map((m) => (
                        <span key={m.metric} style={{ fontSize: 11, color: STATUS_COLORS[m.status] }}>
                          {m.metric}: {m.status.replace('_', ' ')}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span style={{ color: 'var(--muted)' }}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
