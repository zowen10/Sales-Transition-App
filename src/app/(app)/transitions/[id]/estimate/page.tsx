'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface PhaseResult { id: string; name: string; durationWeeks: number; startDate: string; endDate: string; hours: number; investment: number }
interface ProductResult { id: string; name: string; hours: number; investment: number; weeklyHours: number[] }
interface RoleResult { name: string; resourceGroup: string; product: string; weeklyHours: number[]; totalHours: number; overriddenWorkIndexes: number[] }
interface WeekEntry { index: number; workIndex: number | null; phaseId: string | null; weekStart: string; holiday: { name: string; date: string } | null }
interface EstimationResult {
  weeks: WeekEntry[]; roles: RoleResult[]; phases: PhaseResult[]; products: ProductResult[];
  weeklyHours: number[]; weeklyFte: number[]; totalHours: number; baseInvestment: number; contingencyAmount: number;
  totalInvestment: number; averageFte: number; peakWeeklyBurnHours: number; calendarWeeks: number; workingWeeks: number;
  holidays: { name: string; date: string }[]; trace: { output: string; formula: string; inputs: Record<string, unknown>; value: number }[];
}
interface InputSnapshot {
  startDate: string; ratePerHour: number; contingencyPercent: number; holidayMode: 'include' | 'exclude' | 'partial'; holidayReductionPercent: number;
  phases: { id: string; name: string; durationWeeks: number }[];
  phaseAdjustments: Record<string, number>; productAdjustments: Record<string, number>; resourceGroupMultipliers: Record<string, number>;
  overrides?: Record<string, number>;
}
interface PlanVersionDetail {
  id: string; scenarioName: string; status: string; versionNumber: number; recommended: boolean;
  template: { name: string; version: number }; templateBody: any;
  inputSnapshot: InputSnapshot; result: EstimationResult;
}

const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
const int = (n: number) => Math.round(n).toLocaleString('en-US');
const EDITABLE_STATUSES = ['DRAFT', 'IN_PROGRESS', 'CHANGES_REQUESTED'];

export default function EstimatePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const search = useSearchParams();
  const versionParam = search.get('version');

  const [planVersionId, setPlanVersionId] = useState<string | null>(versionParam);
  const [pv, setPv] = useState<PlanVersionDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [roleOverrideDraft, setRoleOverrideDraft] = useState<Record<string, string>>({});

  const loadTransitionPlanVersion = useCallback(async () => {
    const res = await fetch(`/api/transitions/${params.id}`);
    if (!res.ok) return;
    const t = await res.json();
    if (t.currentPlanVersionId) setPlanVersionId(t.currentPlanVersionId);
  }, [params.id]);

  const loadPlanVersion = useCallback(async (id: string) => {
    const res = await fetch(`/api/plan-versions/${id}`);
    if (!res.ok) return;
    setPv(await res.json());
  }, []);

  useEffect(() => {
    if (!planVersionId) loadTransitionPlanVersion();
  }, [planVersionId, loadTransitionPlanVersion]);

  useEffect(() => {
    if (planVersionId) loadPlanVersion(planVersionId);
  }, [planVersionId, loadPlanVersion]);

  async function generatePlan() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/transitions/${params.id}/plan`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ scenarioName: 'Baseline' }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Failed to generate plan.');
      return;
    }
    const body = await res.json();
    setPlanVersionId(body.planVersionId);
    router.replace(`/transitions/${params.id}/estimate?version=${body.planVersionId}`);
  }

  const editable = pv ? EDITABLE_STATUSES.includes(pv.status) : false;

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  async function patch(overrides: Record<string, unknown>, immediate = false) {
    if (!pv) return;
    const run = async () => {
      setStatus('Saving…');
      const res = await fetch(`/api/plan-versions/${pv.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(overrides),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setStatus('');
        setError(body.error ?? 'Failed to recalculate.');
        return;
      }
      await loadPlanVersion(pv.id);
      setStatus(`Recalculated at ${new Date().toLocaleTimeString()}`);
    };
    if (immediate) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      await run();
    } else {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(run, 400);
    }
  }

  async function resetToBaseline() {
    if (!pv?.templateBody) return;
    const t = pv.templateBody;
    await patch(
      {
        ratePerHour: t.defaults.ratePerHour,
        contingencyPercent: t.defaults.contingencyPercent,
        startDate: t.defaults.startDate,
        holidayMode: t.defaults.holidayMode,
        holidayReductionPercent: t.defaults.holidayReductionPercent,
        phaseDurationWeeks: Object.fromEntries(t.phases.map((p: any) => [p.id, p.durationWeeks])),
        phaseAdjustments: Object.fromEntries(t.phases.map((p: any) => [p.id, 1])),
        productAdjustments: Object.fromEntries(t.products.map((p: any) => [p.id, 1])),
        resourceGroupMultipliers: { design: 1, functional: 1, technical: 1, program: 1 },
        overrides: {},
      },
      true
    );
  }

  async function applyRoleOverrides() {
    const overrides: Record<string, number> = { ...(pv?.inputSnapshot.overrides ?? {}) };
    for (const [key, v] of Object.entries(roleOverrideDraft)) {
      if (v.trim() === '') continue;
      overrides[key] = Number(v);
    }
    await patch({ overrides }, true);
    setRoleOverrideDraft({});
  }

  if (!planVersionId) {
    return (
      <div className="card" style={{ padding: 40, textAlign: 'center' }}>
        <p style={{ color: 'var(--muted)', marginBottom: 16 }}>No plan has been generated yet for this transition.</p>
        <button className="btn btn-primary" onClick={generatePlan} disabled={loading}>
          {loading ? 'Generating…' : 'Generate Plan'}
        </button>
        {error && <p style={{ color: '#b42318', fontSize: 12, marginTop: 12 }}>{error}</p>}
      </div>
    );
  }

  if (!pv) return <p style={{ color: 'var(--muted)' }}>Loading estimate…</p>;

  const { result, inputSnapshot: input } = pv;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <h2 style={{ fontSize: 16, margin: 0 }}>
            v{pv.versionNumber} — {pv.scenarioName} {pv.recommended && <span className="badge">Recommended</span>}
          </h2>
          <p style={{ fontSize: 12, color: 'var(--muted)', margin: '4px 0 0' }}>
            Template: {pv.template.name} v{pv.template.version} · Status: <strong>{pv.status.replace(/_/g, ' ')}</strong>
            {!editable && ' — locked, create a new scenario to change it'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={resetToBaseline} disabled={!editable}>
            Reset to template baseline
          </button>
          <button className="btn" onClick={() => window.print()}>
            Print / Save PDF
          </button>
        </div>
      </div>
      {status && <div style={{ fontSize: 11, color: 'var(--teal-dark)', marginBottom: 8 }}>{status}</div>}
      {error && <div style={{ fontSize: 12, color: '#b42318', marginBottom: 8 }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '270px 1fr', gap: 16, alignItems: 'start' }}>
        <aside className="card" style={{ padding: 16, position: 'sticky', top: 12 }}>
          <h3 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--teal-dark)', margin: '0 0 10px' }}>Scenario controls</h3>

          <FieldGroup title="Commercials">
            <Field label="Services rate (USD/hr)">
              <input className="input" type="number" defaultValue={input.ratePerHour} disabled={!editable} onBlur={(e) => patch({ ratePerHour: Number(e.target.value) }, true)} />
            </Field>
            <Field label={`Contingency (${input.contingencyPercent}%)`}>
              <input className="range" type="range" min={0} max={25} defaultValue={input.contingencyPercent} disabled={!editable} onMouseUp={(e) => patch({ contingencyPercent: Number((e.target as HTMLInputElement).value) }, true)} />
            </Field>
          </FieldGroup>

          <FieldGroup title="Project dates">
            <Field label="Start date">
              <input className="input" type="date" defaultValue={input.startDate} disabled={!editable} onBlur={(e) => patch({ startDate: e.target.value }, true)} />
            </Field>
          </FieldGroup>

          <FieldGroup title="Holiday treatment">
            <Field label="Treatment">
              <select className="input" defaultValue={input.holidayMode} disabled={!editable} onChange={(e) => patch({ holidayMode: e.target.value }, true)}>
                <option value="include">Include full holiday weeks</option>
                <option value="exclude">Black out + extend schedule</option>
                <option value="partial">Partial billable holiday weeks</option>
              </select>
            </Field>
            {input.holidayMode === 'partial' && (
              <Field label={`PM reduction (${input.holidayReductionPercent}%)`}>
                <input className="range" type="range" min={0} max={100} defaultValue={input.holidayReductionPercent} disabled={!editable} onMouseUp={(e) => patch({ holidayReductionPercent: Number((e.target as HTMLInputElement).value) }, true)} />
              </Field>
            )}
          </FieldGroup>

          <FieldGroup title="Phase duration (weeks)">
            {input.phases.map((p) => (
              <Field key={p.id} label={`${p.name} (${p.durationWeeks}w)`}>
                <input className="range" type="range" min={1} max={24} defaultValue={p.durationWeeks} disabled={!editable} onMouseUp={(e) => patch({ phaseDurationWeeks: { [p.id]: Number((e.target as HTMLInputElement).value) } }, true)} />
              </Field>
            ))}
          </FieldGroup>

          <FieldGroup title="Resource multipliers">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {(['design', 'functional', 'technical', 'program'] as const).map((g) => (
                <div key={g}>
                  <label style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>{g}</label>
                  <input
                    className="input"
                    type="number"
                    step={0.05}
                    min={0}
                    max={3}
                    defaultValue={input.resourceGroupMultipliers[g] ?? 1}
                    disabled={!editable}
                    onBlur={(e) => patch({ resourceGroupMultipliers: { [g]: Number(e.target.value) } }, true)}
                  />
                </div>
              ))}
            </div>
            <p style={{ fontSize: 10, color: 'var(--muted)', marginTop: 6 }}>1.00 = template baseline.</p>
          </FieldGroup>
        </aside>

        <main style={{ display: 'grid', gap: 16 }}>
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
            <SummaryCard label="Total investment" value={money(result.totalInvestment)} sub={`${input.contingencyPercent}% contingency included`} />
            <SummaryCard label="MA hours" value={int(result.totalHours)} sub={`${result.averageFte.toFixed(1)} average FTE`} />
            <SummaryCard label="Schedule" value={`${result.calendarWeeks} cal. wks`} sub={`${result.workingWeeks} working weeks`} />
            <SummaryCard label="Peak weekly burn" value={`${int(result.peakWeeklyBurnHours)} hrs`} sub="Busiest modeled week" />
            <SummaryCard label="Base / contingency" value={money(result.baseInvestment)} sub={`+ ${money(result.contingencyAmount)} contingency`} />
          </section>

          <section className="card" style={{ padding: 16 }}>
            <h3 style={{ fontSize: 13, margin: '0 0 10px' }}>Phase & product summary</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 20 }}>
              <div>
                <h4 style={{ fontSize: 11, color: 'var(--teal-dark)', textTransform: 'uppercase', margin: '0 0 6px' }}>By phase</h4>
                <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ color: 'var(--muted)', fontSize: 10, textAlign: 'left' }}>
                      <th>Phase</th><th>Weeks</th><th>Hours</th><th>Adj %</th><th>Investment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.phases.map((p) => (
                      <tr key={p.id} style={{ borderTop: '1px solid var(--line)' }}>
                        <td style={{ padding: '6px 0' }}>{p.name}</td>
                        <td>{p.durationWeeks}</td>
                        <td>{int(p.hours)}</td>
                        <td>
                          <input
                            className="input"
                            style={{ width: 60, padding: '4px 6px' }}
                            type="number"
                            defaultValue={Math.round((input.phaseAdjustments[p.id] ?? 1) * 100)}
                            disabled={!editable}
                            onBlur={(e) => patch({ phaseAdjustments: { [p.id]: Number(e.target.value) / 100 } }, true)}
                          />
                        </td>
                        <td>{money(p.investment)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <h4 style={{ fontSize: 11, color: 'var(--teal-dark)', textTransform: 'uppercase', margin: '0 0 6px' }}>By product workstream</h4>
                <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ color: 'var(--muted)', fontSize: 10, textAlign: 'left' }}>
                      <th>Product</th><th>Hours</th><th>Adj %</th><th>Investment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.products.map((p) => (
                      <tr key={p.id} style={{ borderTop: '1px solid var(--line)' }}>
                        <td style={{ padding: '6px 0' }}>{p.name}</td>
                        <td>{int(p.hours)}</td>
                        <td>
                          <input
                            className="input"
                            style={{ width: 60, padding: '4px 6px' }}
                            type="number"
                            defaultValue={Math.round((input.productAdjustments[p.id] ?? 1) * 100)}
                            disabled={!editable}
                            onBlur={(e) => patch({ productAdjustments: { [p.id]: Number(e.target.value) / 100 } }, true)}
                          />
                        </td>
                        <td>{money(p.investment)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className="card" style={{ padding: 16 }}>
            <h3 style={{ fontSize: 13, margin: '0 0 10px' }}>Weekly burn</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', fontSize: 11, minWidth: 640 }}>
                <thead>
                  <tr style={{ color: 'var(--muted)', textAlign: 'left' }}>
                    <th style={{ padding: '4px 8px' }}>Wk</th>
                    <th style={{ padding: '4px 8px' }}>Date</th>
                    <th style={{ padding: '4px 8px' }}>Phase</th>
                    <th style={{ padding: '4px 8px' }}>Holiday</th>
                    <th style={{ padding: '4px 8px' }}>Hours</th>
                    <th style={{ padding: '4px 8px' }}>FTE</th>
                  </tr>
                </thead>
                <tbody>
                  {result.weeks.map((w, i) => (
                    <tr key={w.index} style={{ borderTop: '1px solid var(--line)', background: w.holiday ? 'rgba(255,120,101,0.08)' : 'transparent' }}>
                      <td style={{ padding: '4px 8px' }}>W{w.index}</td>
                      <td style={{ padding: '4px 8px' }}>{w.weekStart}</td>
                      <td style={{ padding: '4px 8px' }}>{w.phaseId ?? 'Blackout'}</td>
                      <td style={{ padding: '4px 8px', color: '#b42318' }}>{w.holiday?.name ?? ''}</td>
                      <td style={{ padding: '4px 8px' }}>{int(result.weeklyHours[i] ?? 0)}</td>
                      <td style={{ padding: '4px 8px' }}>{(result.weeklyFte[i] ?? 0).toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card" style={{ padding: 16 }}>
            <h3 style={{ fontSize: 13, margin: '0 0 10px' }}>Role-level detail</h3>
            {result.products.map((p) => (
              <div key={p.id} style={{ marginBottom: 8 }}>
                <button className="btn" style={{ width: '100%', justifyContent: 'space-between' }} onClick={() => setExpandedProduct(expandedProduct === p.id ? null : p.id)}>
                  <span>{p.name}</span>
                  <span>{int(p.hours)} hrs</span>
                </button>
                {expandedProduct === p.id && (
                  <div style={{ overflowX: 'auto', marginTop: 8 }}>
                    <table style={{ borderCollapse: 'collapse', fontSize: 10, minWidth: 640 }}>
                      <thead>
                        <tr style={{ color: 'var(--muted)', textAlign: 'left' }}>
                          <th style={{ padding: '3px 6px' }}>Role</th>
                          {result.weeks.filter((w) => w.workIndex !== null).slice(0, 16).map((w) => (
                            <th key={w.index} style={{ padding: '3px 4px' }}>W{w.index}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {result.roles.filter((r) => r.product === p.id).map((r) => (
                          <tr key={r.name} style={{ borderTop: '1px solid var(--line)' }}>
                            <td style={{ padding: '3px 6px', whiteSpace: 'nowrap' }}>
                              {r.name} {r.overriddenWorkIndexes.length > 0 && <span className="badge" style={{ fontSize: 8 }}>override</span>}
                            </td>
                            {result.weeks.filter((w) => w.workIndex !== null).slice(0, 16).map((w) => {
                              const wi = w.workIndex as number;
                              const key = `${r.name}|${wi}`;
                              const current = r.weeklyHours[result.weeks.indexOf(w)] ?? 0;
                              return (
                                <td key={wi} style={{ padding: '2px' }}>
                                  <input
                                    className="input"
                                    style={{ width: 40, padding: '2px', fontSize: 10, textAlign: 'center' }}
                                    type="number"
                                    disabled={!editable}
                                    defaultValue={Math.round(current * 100) / 100}
                                    onChange={(e) => setRoleOverrideDraft((d) => ({ ...d, [key]: e.target.value }))}
                                  />
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>Showing first 16 working weeks. Edits are overrides — apply below to recalculate.</p>
                  </div>
                )}
              </div>
            ))}
            {editable && Object.keys(roleOverrideDraft).length > 0 && (
              <button className="btn btn-primary" onClick={applyRoleOverrides} style={{ marginTop: 8 }}>
                Apply role-hour overrides
              </button>
            )}
          </section>

          <section className="card" style={{ padding: 16 }}>
            <h3 style={{ fontSize: 13, margin: '0 0 10px' }}>Calculation trace — &ldquo;Why this number?&rdquo;</h3>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
              {result.trace.map((t) => (
                <li key={t.output} style={{ fontSize: 12, borderTop: '1px solid var(--line)', paddingTop: 8 }}>
                  <strong>{t.output}</strong> = {typeof t.value === 'number' ? int(t.value) : String(t.value)}
                  <div style={{ color: 'var(--muted)', fontSize: 11 }}>{t.formula}</div>
                </li>
              ))}
            </ul>
          </section>
        </main>
      </div>
    </div>
  );
}

function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 800, marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <label style={{ display: 'block', fontSize: 10, color: 'var(--muted)', marginBottom: 3 }}>{label}</label>
      {children}
    </div>
  );
}

function SummaryCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, margin: '6px 0 2px', color: 'var(--teal-dark)' }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--muted)' }}>{sub}</div>
    </div>
  );
}
