'use client';

import { useState } from 'react';
import type { LeverConfig } from '@/domain/staffingModel/types';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <span style={{ fontSize: 11, color: 'var(--muted)', minWidth: 150 }}>{label}</span>
      {children}
    </div>
  );
}

function NumberField({ value, onChange, step = 1, min = 0 }: { value: number; onChange: (v: number) => void; step?: number; min?: number }) {
  return (
    <input
      className="input"
      type="number"
      min={min}
      step={step}
      value={value}
      onChange={(e) => onChange(Math.max(min, Number(e.target.value) || 0))}
      style={{ width: 100 }}
    />
  );
}

/**
 * The "flexibility to pick which variables participate" requirement: every
 * mechanic ported from the reference calculator's fixed sidebar is here as
 * an independently toggleable lever. Disabling a lever removes its
 * mechanic from the simulation entirely (src/domain/staffingModel/engine.ts),
 * not just zeroes a value that still participates.
 */
export default function LeverList({ levers, onChange }: { levers: LeverConfig; onChange: (next: LeverConfig) => void }) {
  const [newEventLabel, setNewEventLabel] = useState('');
  const [newEventDay, setNewEventDay] = useState(0);
  const [newEventCount, setNewEventCount] = useState(0);

  function update<K extends keyof LeverConfig>(key: K, patch: Partial<LeverConfig[K]>) {
    onChange({ ...levers, [key]: { ...levers[key], ...patch } });
  }

  function toggleEnabled(key: keyof LeverConfig) {
    update(key, { enabled: !levers[key].enabled } as Partial<LeverConfig[typeof key]>);
  }

  return (
    <div>
      <section style={{ marginBottom: 16 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 12, marginBottom: 8 }}>
          <input type="checkbox" checked={levers.steadyStateExecution.enabled} onChange={() => toggleEnabled('steadyStateExecution')} />
          Steady-state execution
        </label>
        <Row label="Cases / day">
          <NumberField value={levers.steadyStateExecution.casesPerDay} onChange={(v) => update('steadyStateExecution', { casesPerDay: v })} />
        </Row>
      </section>

      <section style={{ marginBottom: 16 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 12, marginBottom: 8 }}>
          <input type="checkbox" checked={levers.executionDrivenIssues.enabled} onChange={() => toggleEnabled('executionDrivenIssues')} />
          Execution-driven issues
        </label>
        <Row label="Cases / issue">
          <NumberField value={levers.executionDrivenIssues.casesPerIssue} step={0.1} min={0.1} onChange={(v) => update('executionDrivenIssues', { casesPerIssue: v })} />
        </Row>
      </section>

      <section style={{ marginBottom: 16 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 12, marginBottom: 8 }}>
          <input type="checkbox" checked={levers.calendarDrivenIssues.enabled} onChange={() => toggleEnabled('calendarDrivenIssues')} />
          Calendar-driven issues
        </label>
        <div className="hint" style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 6 }}>
          Issues arriving on an independent rate, decoupled from execution pace.
        </div>
        <Row label="Base issues / day">
          <NumberField value={levers.calendarDrivenIssues.baseRatePerDay} step={0.1} onChange={(v) => update('calendarDrivenIssues', { baseRatePerDay: v })} />
        </Row>
      </section>

      <section style={{ marginBottom: 16 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 12, marginBottom: 8 }}>
          <input type="checkbox" checked={levers.issueInfluxEvents.enabled} onChange={() => toggleEnabled('issueInfluxEvents')} />
          Issue influx events
        </label>
        {levers.issueInfluxEvents.events.map((ev) => (
          <div key={ev.id} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, flex: 1 }}>{ev.label} — day {ev.day}, +{ev.issueCount} issues</span>
            <button
              type="button"
              className="btn"
              onClick={() => update('issueInfluxEvents', { events: levers.issueInfluxEvents.events.filter((e) => e.id !== ev.id) })}
            >
              Remove
            </button>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          <input className="input" placeholder="Label" value={newEventLabel} onChange={(e) => setNewEventLabel(e.target.value)} style={{ flex: 1 }} />
          <input className="input" type="number" placeholder="Day" value={newEventDay} onChange={(e) => setNewEventDay(Number(e.target.value) || 0)} style={{ width: 70 }} />
          <input className="input" type="number" placeholder="Issues" value={newEventCount} onChange={(e) => setNewEventCount(Number(e.target.value) || 0)} style={{ width: 80 }} />
          <button
            type="button"
            className="btn"
            onClick={() => {
              if (!newEventLabel.trim() || newEventCount <= 0) return;
              update('issueInfluxEvents', {
                events: [
                  ...levers.issueInfluxEvents.events,
                  { id: `event-${Date.now()}`, label: newEventLabel.trim(), day: newEventDay, issueCount: newEventCount },
                ],
              });
              setNewEventLabel('');
              setNewEventDay(0);
              setNewEventCount(0);
            }}
          >
            Add
          </button>
        </div>
      </section>

      <section style={{ marginBottom: 16 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 12, marginBottom: 8 }}>
          <input type="checkbox" checked={levers.blockedCaseThrottling.enabled} onChange={() => toggleEnabled('blockedCaseThrottling')} />
          Blocked-case throttling
        </label>
        <Row label="Blocked cases / issue">
          <NumberField value={levers.blockedCaseThrottling.blockedCasesPerIssue} step={0.1} onChange={(v) => update('blockedCaseThrottling', { blockedCasesPerIssue: v })} />
        </Row>
      </section>

      <section style={{ marginBottom: 16 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 12, marginBottom: 8 }}>
          <input type="checkbox" checked={levers.reopenRate.enabled} onChange={() => toggleEnabled('reopenRate')} />
          Reopen rate
        </label>
        <Row label="Reopen %">
          <NumberField value={levers.reopenRate.reopenRatePercent} min={0} onChange={(v) => update('reopenRate', { reopenRatePercent: v })} />
        </Row>
      </section>

      <section style={{ marginBottom: 16 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 12, marginBottom: 8 }}>
          <input type="checkbox" checked={levers.clientReviewBuffer.enabled} onChange={() => toggleEnabled('clientReviewBuffer')} />
          Client review buffer
        </label>
        <Row label="Buffer days">
          <NumberField value={levers.clientReviewBuffer.bufferDays} onChange={(v) => update('clientReviewBuffer', { bufferDays: v })} />
        </Row>
      </section>

      <section>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 12, marginBottom: 8 }}>
          <input type="checkbox" checked={levers.resolutionCapacity.enabled} onChange={() => toggleEnabled('resolutionCapacity')} />
          Resolution capacity
        </label>
        <Row label="Issues / day / FTE">
          <NumberField value={levers.resolutionCapacity.issuesPerDayPerFte} step={0.1} onChange={(v) => update('resolutionCapacity', { issuesPerDayPerFte: v })} />
        </Row>
        <Row label="FTE count">
          <NumberField value={levers.resolutionCapacity.fteCount} step={0.5} onChange={(v) => update('resolutionCapacity', { fteCount: v })} />
        </Row>
      </section>
    </div>
  );
}
