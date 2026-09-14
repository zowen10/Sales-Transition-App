'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

interface QuestionDTO {
  id: string;
  key: string;
  section: string;
  prompt: string;
  helpText?: string | null;
  responseType: 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'boolean';
  options?: string[] | null;
  required: boolean;
  highImpact: boolean;
}

interface QuestionsResponse {
  questions: QuestionDTO[];
  answers: Record<string, unknown>;
  confirmedKeys: string[];
  progress: { section: string; totalApplicable: number; answered: number; confirmed: number; unresolved: number }[];
}

const SECTION_ORDER = [
  'Engagement context',
  'Scope and plan classification',
  'Complexity drivers',
  'Timeline and milestones',
  'Delivery readiness',
  'Commercial assumptions',
  'Risks and open questions',
];

function QuestionInput({
  question,
  value,
  onChange,
}: {
  question: QuestionDTO;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  if (question.responseType === 'boolean') {
    return (
      <select className="input" value={value === true ? 'yes' : value === false ? 'no' : ''} onChange={(e) => onChange(e.target.value === 'yes')}>
        <option value="">Select…</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
    );
  }
  if (question.responseType === 'select') {
    return (
      <select className="input" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select…</option>
        {question.options?.map((o) => (
          <option key={o} value={o}>
            {o.replace(/_/g, ' ')}
          </option>
        ))}
      </select>
    );
  }
  if (question.responseType === 'multiselect') {
    const arr = Array.isArray(value) ? (value as string[]) : [];
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {question.options?.map((o) => (
          <label key={o} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, border: '1px solid var(--line)', borderRadius: 8, padding: '5px 9px' }}>
            <input
              type="checkbox"
              checked={arr.includes(o)}
              onChange={() => onChange(arr.includes(o) ? arr.filter((x) => x !== o) : [...arr, o])}
            />
            {o.replace(/_/g, ' ')}
          </label>
        ))}
      </div>
    );
  }
  if (question.responseType === 'number') {
    return <input className="input" type="number" value={(value as number) ?? ''} onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))} />;
  }
  if (question.responseType === 'date') {
    return <input className="input" type="date" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} />;
  }
  return <textarea className="input" rows={2} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} />;
}

function useSpeechToText(onResult: (text: string) => void) {
  const [recording, setRecording] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported(typeof window !== 'undefined' && Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition));
  }, []);

  const start = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const recognition = new SR();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setRecording(true);
    recognition.onend = () => setRecording(false);
    recognition.onerror = () => setRecording(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0]?.[0]?.transcript ?? '';
      onResult(transcript);
    };
    recognition.start();
  }, [onResult]);

  return { start, recording, supported };
}

export default function IntakePage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<QuestionsResponse | null>(null);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [sectionIndex, setSectionIndex] = useState(0);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [transcriptFor, setTranscriptFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/transitions/${params.id}/questions`);
    if (!res.ok) return;
    const body: QuestionsResponse = await res.json();
    setData(body);
    setDraft((prev) => ({ ...body.answers, ...prev }));
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  const sections = useMemo(() => {
    if (!data) return [];
    const present = new Set(data.questions.map((q) => q.section));
    return SECTION_ORDER.filter((s) => present.has(s));
  }, [data]);

  const currentSection = sections[sectionIndex];
  const questionsInSection = data?.questions.filter((q) => q.section === currentSection) ?? [];

  async function saveAnswer(question: QuestionDTO, value: unknown, confirm: boolean, source: 'text' | 'voice' = 'text') {
    setSaving(question.key);
    setError(null);
    const res = await fetch(`/api/transitions/${params.id}/answers`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ questionKey: question.key, value, source, isConfirmed: confirm }),
    });
    setSaving(null);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Failed to save answer.');
      return;
    }
    await load();
  }

  const progressForSection = (section: string) => data?.progress.find((p) => p.section === section);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 16 }}>
      <aside className="card" style={{ padding: 12, alignSelf: 'start' }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 8 }}>Sections</div>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 4 }}>
          {sections.map((s, i) => {
            const p = progressForSection(s);
            return (
              <li key={s}>
                <button
                  onClick={() => setSectionIndex(i)}
                  className="btn"
                  style={{
                    width: '100%',
                    justifyContent: 'space-between',
                    background: i === sectionIndex ? 'rgba(15,157,143,0.1)' : 'white',
                    borderColor: i === sectionIndex ? 'var(--teal)' : 'var(--line)',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: 12 }}>{s}</span>
                  <span style={{ fontSize: 10, color: p?.unresolved ? '#b42318' : 'var(--muted)' }}>
                    {p ? `${p.confirmed}/${p.totalApplicable}` : ''}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      <div className="card" style={{ padding: 20 }}>
        <h2 style={{ fontSize: 15, margin: '0 0 4px' }}>{currentSection ?? 'Loading…'}</h2>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>
          Answer by typing or using the microphone. High-impact fields must be explicitly confirmed.
        </p>

        {error && (
          <div role="alert" style={{ color: '#b42318', fontSize: 12, marginBottom: 12 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'grid', gap: 18 }}>
          {questionsInSection.map((q) => (
            <QuestionRow
              key={q.key}
              question={q}
              value={draft[q.key]}
              confirmed={data?.confirmedKeys.includes(q.key) ?? false}
              saving={saving === q.key}
              transcriptOpen={transcriptFor === q.key}
              onOpenTranscript={() => setTranscriptFor(q.key)}
              onCloseTranscript={() => setTranscriptFor(null)}
              onChange={(v) => setDraft((d) => ({ ...d, [q.key]: v }))}
              onSave={(v, confirm, source) => saveAnswer(q, v, confirm, source)}
            />
          ))}
          {questionsInSection.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13 }}>No applicable questions in this section yet.</p>}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
          <button className="btn" disabled={sectionIndex === 0} onClick={() => setSectionIndex((i) => Math.max(0, i - 1))}>
            ← Back
          </button>
          <button className="btn btn-primary" disabled={sectionIndex >= sections.length - 1} onClick={() => setSectionIndex((i) => Math.min(sections.length - 1, i + 1))}>
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}

function QuestionRow({
  question,
  value,
  confirmed,
  saving,
  transcriptOpen,
  onOpenTranscript,
  onCloseTranscript,
  onChange,
  onSave,
}: {
  question: QuestionDTO;
  value: unknown;
  confirmed: boolean;
  saving: boolean;
  transcriptOpen: boolean;
  onOpenTranscript: () => void;
  onCloseTranscript: () => void;
  onChange: (v: unknown) => void;
  onSave: (value: unknown, confirm: boolean, source?: 'text' | 'voice') => void;
}) {
  const [transcript, setTranscript] = useState('');
  const { start, recording, supported } = useSpeechToText((text) => {
    setTranscript(text);
    onOpenTranscript();
  });

  return (
    <div style={{ borderBottom: '1px solid var(--line)', paddingBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <label style={{ fontSize: 13, fontWeight: 700 }}>
          {question.prompt}
          {question.required && <span style={{ color: '#b42318' }}> *</span>}
          {question.highImpact && <span className="badge" style={{ marginLeft: 8, fontSize: 9 }}>High impact</span>}
        </label>
        {supported && question.responseType === 'text' && (
          <button type="button" className="btn" onClick={start} aria-label={`Record answer for ${question.prompt}`} style={{ fontSize: 11 }}>
            {recording ? '● Recording…' : '🎙 Record'}
          </button>
        )}
      </div>
      {question.helpText && <p style={{ fontSize: 11, color: 'var(--muted)', margin: '4px 0' }}>{question.helpText}</p>}

      {transcriptOpen ? (
        <div style={{ marginTop: 6 }}>
          <textarea className="input" rows={2} value={transcript} onChange={(e) => setTranscript(e.target.value)} aria-label="Editable transcript" />
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <button className="btn btn-primary" onClick={() => { onChange(transcript); onSave(transcript, question.highImpact, 'voice'); onCloseTranscript(); }}>
              Use transcript
            </button>
            <button className="btn" onClick={onCloseTranscript}>
              Discard
            </button>
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 6 }}>
          <QuestionInput question={question} value={value} onChange={onChange} />
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
        <button className="btn" disabled={saving} onClick={() => onSave(value, false)}>
          Save
        </button>
        <button className="btn btn-primary" disabled={saving} onClick={() => onSave(value, true)}>
          {confirmed ? '✓ Confirmed' : 'Confirm'}
        </button>
        {confirmed && <span style={{ fontSize: 11, color: 'var(--teal-dark)' }}>Confirmed</span>}
      </div>
    </div>
  );
}
