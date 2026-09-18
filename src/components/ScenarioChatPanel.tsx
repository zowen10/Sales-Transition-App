'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSpeechToText } from '@/lib/useSpeechToText';
import type { LeverConfig } from '@/domain/staffingModel/types';

interface ChatTurn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  proposedChange: Partial<LeverConfig> | null;
  applied?: boolean;
  createdAt: string;
}

/**
 * Docked chat panel for talking to the scenario — text or voice
 * (useSpeechToText, shared with the intake screen). The assistant's replies
 * are always Apply-only: a proposedChange is rendered as a diff and only
 * merged into the parent's lever state when the PM clicks Apply, exactly
 * like the derive-from-import proposal on the workspace page. Nothing here
 * ever calls the simulation engine itself.
 */
export default function ScenarioChatPanel({
  scenarioId,
  currentLevers,
  onApplyProposal,
}: {
  scenarioId: string;
  currentLevers: LeverConfig;
  onApplyProposal: (patch: Partial<LeverConfig>) => void;
}) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/staffing-scenarios/${scenarioId}/chat`);
    if (!res.ok) return;
    const body = await res.json();
    setTurns(body.turns);
  }, [scenarioId]);

  useEffect(() => {
    load();
  }, [load]);

  const { start, recording, supported } = useSpeechToText((text) => setInput((prev) => (prev ? `${prev} ${text}` : text)));

  async function send() {
    if (!input.trim() || sending) return;
    const message = input.trim();
    setInput('');
    setSending(true);
    setError(null);
    setTurns((prev) => [...prev, { id: `pending-${Date.now()}`, role: 'user', content: message, proposedChange: null, createdAt: new Date().toISOString() }]);
    const res = await fetch(`/api/staffing-scenarios/${scenarioId}/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    setSending(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Failed to send message.');
      return;
    }
    await load();
  }

  async function applyTurn(turn: ChatTurn) {
    if (!turn.proposedChange) return;
    onApplyProposal(turn.proposedChange);
    await fetch(`/api/staffing-scenarios/${scenarioId}/chat/${turn.id}/apply`, { method: 'POST' });
    await load();
  }

  return (
    <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', height: 420 }}>
      <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 8 }}>Talk to this plan</div>
      <div style={{ flex: 1, overflowY: 'auto', marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {turns.length === 0 && (
          <div style={{ color: 'var(--muted)', fontSize: 11 }}>
            Ask things like &quot;what if we add 2 more FTEs?&quot; or &quot;why are we behind?&quot;
          </div>
        )}
        {turns.map((t) => (
          <div key={t.id} style={{ alignSelf: t.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
            <div
              style={{
                background: t.role === 'user' ? 'var(--teal)' : 'var(--bg)',
                color: t.role === 'user' ? '#fff' : 'var(--ink)',
                border: t.role === 'user' ? 'none' : '1px solid var(--line)',
                borderRadius: 10,
                padding: '8px 10px',
                fontSize: 12,
                whiteSpace: 'pre-wrap',
              }}
            >
              {t.content}
            </div>
            {t.proposedChange && (
              <div style={{ marginTop: 6, border: '1px solid var(--teal)', borderRadius: 8, padding: 8, fontSize: 11 }}>
                <div style={{ fontWeight: 800, marginBottom: 4 }}>Proposed change</div>
                {Object.entries(t.proposedChange).map(([key, value]) => (
                  <div key={key} style={{ color: 'var(--muted)' }}>
                    {key}: {JSON.stringify(value)}
                  </div>
                ))}
                <button type="button" className="btn btn-primary" style={{ marginTop: 6, fontSize: 11 }} disabled={t.applied} onClick={() => applyTurn(t)}>
                  {t.applied ? 'Applied' : 'Apply'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      {error && <div style={{ color: '#c0392b', fontSize: 11, marginBottom: 8 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          className="input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Ask or propose a change…"
        />
        {supported && (
          <button type="button" className="btn" onClick={start} disabled={recording} title="Speak">
            {recording ? '…' : '🎙'}
          </button>
        )}
        <button type="button" className="btn btn-primary" onClick={send} disabled={sending || !input.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}
