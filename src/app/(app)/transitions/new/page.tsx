'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const PLAN_TYPES = [
  { value: 'SINGLE_SITE', label: 'Single site' },
  { value: 'MULTI_SITE', label: 'Multi-site' },
];

const PRODUCTS = [
  { id: 'wm', name: 'Manhattan ACTIVE Warehouse Management' },
  { id: 'lm', name: 'Labor Management - Basic Enablement' },
  { id: 'sci', name: 'Supply Chain Intelligence' },
  { id: 'slotting', name: 'Slotting' },
  { id: 'mif', name: 'Manhattan Integration Framework - MIF' },
  { id: 'extension', name: 'Extension Placeholder' },
];

export default function NewTransitionPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    clientName: '',
    name: '',
    salesforceOpportunityUrl: '',
    salesTransitionFolderUrl: '',
    planType: 'SINGLE_SITE',
    engagementDirectorName: '',
    salesLeadName: '',
    executiveSponsorName: '',
  });
  const [products, setProducts] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggleProduct(id: string) {
    setProducts((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }

  function onFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files;
    if (!selected) return;
    setFiles((prev) => [...prev, ...Array.from(selected)]);
    e.target.value = '';
  }

  function removeFile(name: string) {
    setFiles((prev) => prev.filter((f) => f.name !== name));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch('/api/transitions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...form, productsInScope: products }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Failed to create project.');
      setSubmitting(false);
      return;
    }
    const created = await res.json();

    // Upload any locally-selected documents against the newly created project.
    for (const file of files) {
      const uploadForm = new FormData();
      uploadForm.append('file', file);
      await fetch(`/api/transitions/${created.id}/documents/upload`, { method: 'POST', body: uploadForm });
    }

    router.push(`/transitions/${created.id}`);
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>New Project</h1>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 20 }}>
        Capture the opportunity handoff details. You&apos;ll complete the guided intake interview next.
      </p>

      <form onSubmit={onSubmit} className="card" style={{ padding: 24, display: 'grid', gap: 14 }}>
        <div>
          <label className="field-label">Client name</label>
          <input className="input" required value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} />
        </div>
        <div>
          <label className="field-label">Project name</label>
          <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Acme Distribution — Phase 1 WM Rollout" />
        </div>

        <div>
          <label className="field-label">Salesforce opportunity URL</label>
          <input
            className="input"
            type="url"
            placeholder="https://manh.lightning.force.com/lightning/r/Opportunity/…"
            value={form.salesforceOpportunityUrl}
            onChange={(e) => setForm({ ...form, salesforceOpportunityUrl: e.target.value })}
          />
        </div>

        <div>
          <label className="field-label">Sales transition SharePoint folder</label>
          <input
            className="input"
            type="url"
            placeholder="https://manh.sharepoint.com/sites/…"
            value={form.salesTransitionFolderUrl}
            onChange={(e) => setForm({ ...form, salesTransitionFolderUrl: e.target.value })}
          />
          <p style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>
            Saved as a reference link. Individual documents from this folder can be linked or uploaded below, or added
            later from the project page.
          </p>
        </div>

        <div>
          <label className="field-label">Local documents</label>
          <label className="btn" style={{ cursor: 'pointer', width: 'fit-content' }}>
            + Add files
            <input type="file" multiple onChange={onFilesSelected} style={{ display: 'none' }} />
          </label>
          {files.length > 0 && (
            <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, display: 'grid', gap: 4 }}>
              {files.map((f) => (
                <li key={f.name} style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between', border: '1px solid var(--line)', borderRadius: 6, padding: '4px 8px' }}>
                  <span>{f.name}</span>
                  <button type="button" onClick={() => removeFile(f.name)} style={{ background: 'none', border: 'none', color: '#b42318', cursor: 'pointer' }}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>Uploaded once the project is created below.</p>
        </div>

        <div>
          <label className="field-label">Plan type</label>
          <select className="input" value={form.planType} onChange={(e) => setForm({ ...form, planType: e.target.value })}>
            {PLAN_TYPES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div>
            <label className="field-label">Engagement Director</label>
            <input className="input" required value={form.engagementDirectorName} onChange={(e) => setForm({ ...form, engagementDirectorName: e.target.value })} placeholder="Type a name" />
          </div>
          <div>
            <label className="field-label">Sales lead</label>
            <input className="input" value={form.salesLeadName} onChange={(e) => setForm({ ...form, salesLeadName: e.target.value })} placeholder="Type a name" />
          </div>
          <div>
            <label className="field-label">Executive sponsor</label>
            <input className="input" value={form.executiveSponsorName} onChange={(e) => setForm({ ...form, executiveSponsorName: e.target.value })} placeholder="Type a name" />
          </div>
        </div>

        <div>
          <label className="field-label">Initial products/services in scope</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
            {PRODUCTS.map((p) => (
              <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, border: '1px solid var(--line)', borderRadius: 8, padding: '6px 10px' }}>
                <input type="checkbox" checked={products.includes(p.id)} onChange={() => toggleProduct(p.id)} />
                {p.name}
              </label>
            ))}
          </div>
        </div>

        {error && (
          <div role="alert" style={{ color: '#b42318', fontSize: 12 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create project'}
          </button>
        </div>
      </form>
      <style jsx>{`
        .field-label {
          display: block;
          font-size: 12px;
          color: var(--muted);
          margin-bottom: 4px;
        }
      `}</style>
    </div>
  );
}
