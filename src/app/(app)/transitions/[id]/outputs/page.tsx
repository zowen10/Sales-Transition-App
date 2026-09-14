'use client';

import { useCallback, useEffect, useState } from 'react';

interface PlanVersionSummary { id: string; versionNumber: number; scenarioName: string; status: string; recommended: boolean }
interface ArtifactJob { id: string; artifactType: string; status: string; fileReference: string | null; errorMessage: string | null; requestedAt: string; completedAt: string | null }

const ARTIFACT_TYPES: { type: string; label: string; description: string }[] = [
  { type: 'SALES_TRANSITION_BRIEF', label: 'Sales Transition Brief', description: 'Client, scope, stakeholders, commercial context, assumptions, risks, decisions.' },
  { type: 'APPROVED_BURN_PLAN', label: 'Approved Burn Plan (Excel)', description: 'Excel workbook — summary, phase/product rollups, weekly burn, role detail. Requires plan to be Approved.' },
  { type: 'SDS_STARTER_PACKAGE', label: 'SDS Starter Package', description: 'Workstream structure, known products/integrations, design topics, open questions.' },
  { type: 'DRAFT_SOW', label: 'Draft SOW', description: 'Scope, deliverables, milestones, assumptions, exclusions, responsibilities — always labeled Draft.' },
  { type: 'KICKOFF_PACKAGE', label: 'Kickoff Package', description: 'Deck outline, agenda, 30/60/90 plan, RACI, RAID, decision log, mobilization checklist.' },
];

export default function OutputsPage({ params }: { params: { id: string } }) {
  const [versions, setVersions] = useState<PlanVersionSummary[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string>('');
  const [jobs, setJobs] = useState<ArtifactJob[]>([]);
  const [generating, setGenerating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/transitions/${params.id}`);
    if (!res.ok) return;
    const t = await res.json();
    setVersions(t.planVersions);
    if (!selectedVersion) {
      const recommended = t.planVersions.find((v: PlanVersionSummary) => v.recommended) ?? t.planVersions[t.planVersions.length - 1];
      if (recommended) setSelectedVersion(recommended.id);
    }
  }, [params.id, selectedVersion]);

  const loadJobs = useCallback(async (versionId: string) => {
    const res = await fetch(`/api/plan-versions/${versionId}/artifacts`);
    if (res.ok) setJobs(await res.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (selectedVersion) loadJobs(selectedVersion);
  }, [selectedVersion, loadJobs]);

  const version = versions.find((v) => v.id === selectedVersion);

  async function generate(artifactType: string) {
    setGenerating(artifactType);
    setError(null);
    const res = await fetch(`/api/plan-versions/${selectedVersion}/artifacts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ artifactType }),
    });
    setGenerating(null);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Failed to generate artifact.');
      return;
    }
    await loadJobs(selectedVersion);
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 16, margin: 0 }}>Outputs</h2>
          <p style={{ fontSize: 12, color: 'var(--muted)', margin: '4px 0 0' }}>
            Generate the pre-kickoff and kickoff package. Every artifact carries plan version, status, and approval metadata.
          </p>
        </div>
        <select className="input" style={{ width: 260 }} value={selectedVersion} onChange={(e) => setSelectedVersion(e.target.value)}>
          {versions.map((v) => (
            <option key={v.id} value={v.id}>
              v{v.versionNumber} — {v.scenarioName} ({v.status.replace(/_/g, ' ')})
            </option>
          ))}
        </select>
      </div>

      {version && (
        <div style={{ marginBottom: 16 }}>
          <span className="badge" style={{ color: version.status === 'APPROVED' ? 'var(--teal-dark)' : '#8a6d3b' }}>
            {version.status === 'APPROVED' ? 'Approved' : 'Draft'}
          </span>
        </div>
      )}

      {error && <div style={{ color: '#b42318', fontSize: 12, marginBottom: 12 }}>{error}</div>}

      <div style={{ display: 'grid', gap: 12 }}>
        {ARTIFACT_TYPES.map((a) => {
          const latestJob = jobs.filter((j) => j.artifactType === a.type).sort((x, y) => +new Date(y.requestedAt) - +new Date(x.requestedAt))[0];
          const disabled = a.type === 'APPROVED_BURN_PLAN' && version?.status !== 'APPROVED';
          return (
            <div key={a.type} className="card" style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{a.label}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{a.description}</div>
                {latestJob && (
                  <div style={{ fontSize: 11, marginTop: 6 }}>
                    Status: <span className="badge">{latestJob.status}</span>{' '}
                    {latestJob.status === 'COMPLETE' && (
                      <a href={`/api/artifacts/${latestJob.id}/download`} style={{ color: 'var(--teal-dark)', fontWeight: 700 }}>
                        Download
                      </a>
                    )}
                    {latestJob.status === 'FAILED' && <span style={{ color: '#b42318' }}>{latestJob.errorMessage}</span>}
                  </div>
                )}
              </div>
              <button className="btn btn-primary" disabled={disabled || generating === a.type || !selectedVersion} onClick={() => generate(a.type)}>
                {generating === a.type ? 'Generating…' : 'Generate'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
