'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface ClassificationResult {
  planType: string;
  productMix: string[];
  siteProfile: { siteCount: number | null; geography: string | null; rolloutSequence: string | null };
  complexityLevel: string;
  integrationProfile: { integrationCount: number | null; usesMif: boolean };
  extensionProfile: { hasCustomExtensions: boolean; extensionCount: number | null };
  dataReadinessProfile: { hasMigrationConcerns: boolean; hasComplianceRequirements: boolean };
  timelinePressure: string;
  commercialModel: string;
  confidenceLevel: string;
  reasons: { field: string; reason: string; sourceQuestionKeys: string[] }[];
}

export default function ClassificationPage({ params }: { params: { id: string } }) {
  const [result, setResult] = useState<ClassificationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/transitions/${params.id}`)
      .then((r) => r.json())
      .then((t) => setResult(t.classification))
      .catch(() => {});
  }, [params.id]);

  async function runClassification() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/transitions/${params.id}/classify`, { method: 'POST' });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Failed to classify.');
      return;
    }
    setResult(await res.json());
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 16, margin: 0 }}>Classification</h2>
          <p style={{ fontSize: 12, color: 'var(--muted)', margin: '4px 0 0' }}>
            Deterministically derived from confirmed intake answers. Re-run any time answers change.
          </p>
        </div>
        <button className="btn btn-primary" onClick={runClassification} disabled={loading}>
          {loading ? 'Classifying…' : result ? 'Re-run classification' : 'Classify transition'}
        </button>
      </div>

      {error && (
        <div role="alert" style={{ color: '#b42318', fontSize: 12, marginBottom: 12 }}>
          {error}
        </div>
      )}

      {!result ? (
        <div className="card" style={{ padding: 30, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
          Not yet classified.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="card" style={{ padding: 18 }}>
            <h3 style={{ fontSize: 13, margin: '0 0 10px' }}>Classification fields</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              <span className="badge">{result.planType.replace(/_/g, ' ')}</span>
              <span className="badge">{result.complexityLevel} complexity</span>
              <span className="badge">{result.timelinePressure} timeline pressure</span>
              <span className="badge">{result.confidenceLevel} confidence</span>
              <span className="badge">{result.commercialModel.replace(/_/g, ' ')}</span>
              {result.integrationProfile.usesMif && <span className="badge">MIF</span>}
              {result.extensionProfile.hasCustomExtensions && <span className="badge">Custom extensions</span>}
              {result.dataReadinessProfile.hasMigrationConcerns && <span className="badge">Migration concerns</span>}
            </div>
            <dl style={{ display: 'grid', gridTemplateColumns: '160px 1fr', rowGap: 6, fontSize: 12 }}>
              <dt style={{ color: 'var(--muted)' }}>Products</dt>
              <dd>{result.productMix.join(', ') || '—'}</dd>
              <dt style={{ color: 'var(--muted)' }}>Site count</dt>
              <dd>{result.siteProfile.siteCount ?? '—'}</dd>
              <dt style={{ color: 'var(--muted)' }}>Integrations</dt>
              <dd>{result.integrationProfile.integrationCount ?? '—'}</dd>
            </dl>
          </div>

          <div className="card" style={{ padding: 18 }}>
            <h3 style={{ fontSize: 13, margin: '0 0 10px' }}>Why these classifications?</h3>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
              {result.reasons.map((r) => (
                <li key={r.field} style={{ fontSize: 12 }}>
                  <strong>{r.field}</strong>
                  <div style={{ color: 'var(--muted)' }}>{r.reason}</div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        <Link href={`/transitions/${params.id}/estimate`} className="btn btn-primary">
          Generate plan →
        </Link>
      </div>
    </div>
  );
}
