'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface UserOption {
  id: string;
  name: string;
  email: string;
  roles: string[];
}

const PLAN_TYPES = [
  { value: 'SINGLE_SITE', label: 'Single site' },
  { value: 'MULTI_SITE', label: 'Multi-site' },
  { value: 'PROGRAM', label: 'Program' },
  { value: 'SPECIALIZED', label: 'Specialized' },
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
  const [users, setUsers] = useState<UserOption[]>([]);
  const [form, setForm] = useState({
    clientName: '',
    opportunityId: '',
    name: '',
    transitionOwnerId: '',
    salesLeadId: '',
    executiveSponsorId: '',
    expectedDecisionDate: '',
    planType: 'SINGLE_SITE',
  });
  const [products, setProducts] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch('/api/users')
      .then((r) => r.json())
      .then(setUsers)
      .catch(() => setUsers([]));
  }, []);

  function toggleProduct(id: string) {
    setProducts((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
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
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Failed to create transition.');
      return;
    }
    const created = await res.json();
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label className="field-label">Opportunity / CRM ID</label>
            <input className="input" value={form.opportunityId} onChange={(e) => setForm({ ...form, opportunityId: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Expected decision date</label>
            <input className="input" type="date" value={form.expectedDecisionDate} onChange={(e) => setForm({ ...form, expectedDecisionDate: e.target.value })} />
          </div>
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
            <label className="field-label">Project owner</label>
            <select className="input" required value={form.transitionOwnerId} onChange={(e) => setForm({ ...form, transitionOwnerId: e.target.value })}>
              <option value="">Select…</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Sales lead</label>
            <select className="input" value={form.salesLeadId} onChange={(e) => setForm({ ...form, salesLeadId: e.target.value })}>
              <option value="">Select…</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Executive sponsor</label>
            <select className="input" value={form.executiveSponsorId} onChange={(e) => setForm({ ...form, executiveSponsorId: e.target.value })}>
              <option value="">Select…</option>
              {users
                .filter((u) => u.roles.includes('EXECUTIVE_APPROVER'))
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
            </select>
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
