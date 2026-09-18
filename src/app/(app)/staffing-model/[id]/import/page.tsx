'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import MappingReviewTable, { mappingDraftFromSuggestion, type MappingDraft } from '@/components/MappingReviewTable';
import type { SuggestedMapping } from '@/domain/issueAnalysis/types';

interface UploadResponse {
  id: string;
  headers: string[];
  sampleRows: Record<string, string>[];
  rowCount: number;
  suggestedMapping: SuggestedMapping;
}

export default function ImportIssueListPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [stageLabel, setStageLabel] = useState('');
  const [purpose, setPurpose] = useState<'baseline' | 'actuals_checkpoint'>('baseline');
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upload, setUpload] = useState<UploadResponse | null>(null);
  const [draft, setDraft] = useState<MappingDraft | null>(null);

  async function doUpload() {
    if (!file) {
      setError('Choose a file to upload.');
      return;
    }
    setUploading(true);
    setError(null);
    const form = new FormData();
    form.append('file', file);
    form.append('scenarioId', params.id);
    if (stageLabel.trim()) form.append('stageLabel', stageLabel.trim());
    form.append('purpose', purpose);
    const res = await fetch('/api/issue-imports', { method: 'POST', body: form });
    setUploading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Failed to upload file.');
      return;
    }
    const body: UploadResponse = await res.json();
    setUpload(body);
    setDraft(mappingDraftFromSuggestion(body.suggestedMapping));
  }

  async function confirmMapping() {
    if (!upload || !draft) return;
    setConfirming(true);
    setError(null);
    const res = await fetch(`/api/issue-imports/${upload.id}/mapping/confirm`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mapping: draft }),
    });
    setConfirming(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Failed to confirm mapping.');
      return;
    }
    router.push(`/staffing-model/${params.id}/analysis?batch=${upload.id}`);
  }

  return (
    <div>
      <h1 style={{ fontSize: 22, margin: '0 0 4px' }}>Import issue list</h1>
      <p style={{ color: 'var(--muted)', fontSize: 13, margin: '0 0 16px', maxWidth: 680 }}>
        Upload an export (CSV or XLSX). The mapping below is what the model interpreted each column to mean — review
        and correct it before anything is used for analysis.
      </p>

      {!upload ? (
        <div className="card" style={{ padding: 20, maxWidth: 480 }}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--muted)', marginBottom: 4 }}>File</label>
            <input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--muted)', marginBottom: 4 }}>
              Stage label <span style={{ fontWeight: 400 }}>(e.g. &quot;SIT week 3&quot;)</span>
            </label>
            <input className="input" value={stageLabel} onChange={(e) => setStageLabel(e.target.value)} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--muted)', marginBottom: 4 }}>Purpose</label>
            <select className="input" value={purpose} onChange={(e) => setPurpose(e.target.value as typeof purpose)}>
              <option value="baseline">Baseline (feeds derived levers)</option>
              <option value="actuals_checkpoint">Actuals checkpoint (compares to a forecast)</option>
            </select>
          </div>
          {error && <div style={{ color: '#c0392b', fontSize: 12, marginBottom: 12 }}>{error}</div>}
          <button type="button" className="btn btn-primary" onClick={doUpload} disabled={uploading}>
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      ) : (
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 4 }}>
            {upload.rowCount} rows detected in {upload.headers.length} columns
          </div>
          <div style={{ color: 'var(--muted)', fontSize: 11, marginBottom: 14 }}>
            Fields left unmapped are simply ignored — nothing is guessed for a field the data doesn&apos;t support.
          </div>
          {draft && (
            <MappingReviewTable headers={upload.headers} suggestion={upload.suggestedMapping} draft={draft} onChange={setDraft} />
          )}
          {error && <div style={{ color: '#c0392b', fontSize: 12, margin: '12px 0' }}>{error}</div>}
          <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-primary" onClick={confirmMapping} disabled={confirming}>
              {confirming ? 'Confirming…' : 'Confirm mapping'}
            </button>
            <button type="button" className="btn" onClick={() => { setUpload(null); setDraft(null); setFile(null); }}>
              Start over
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
