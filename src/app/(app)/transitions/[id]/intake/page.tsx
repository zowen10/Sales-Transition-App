'use client';

import { useCallback, useEffect, useState } from 'react';

interface QuestionDTO {
  id: string;
  key: string;
  section: string;
  prompt: string;
  helpText?: string | null;
  primaryRespondent?: string | null;
  classificationSignal?: string | null;
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
  if (question.responseType === 'number') {
    return <input className="input" type="number" value={(value as number) ?? ''} onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))} />;
  }
  if (question.responseType === 'date') {
    return <input className="input" type="date" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} />;
  }
  return <textarea className="input" rows={3} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} style={{ resize: 'vertical' }} />;
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
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [transcriptFor, setTranscriptFor] = useState<string | null>(null);
  const [documentCount, setDocumentCount] = useState(0);
  const [prefilling, setPrefilling] = useState(false);
  const [prefillNote, setPrefillNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [qRes, tRes] = await Promise.all([
      fetch(`/api/transitions/${params.id}/questions`),
      fetch(`/api/transitions/${params.id}`),
    ]);
    if (qRes.ok) {
      const body: QuestionsResponse = await qRes.json();
      setData(body);
      setDraft((prev) => ({ ...body.answers, ...prev }));
    }
    if (tRes.ok) {
      const t = await tRes.json();
      setDocumentCount(t.documents?.length ?? 0);
    }
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveAnswer(question: QuestionDTO, value: unknown, confirm: boolean, source: 'text' | 'voice' | 'imported' = 'text') {
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

  async function prepopulateFromDocuments() {
    setPrefilling(true);
    setPrefillNote(null);
    setError(null);
    const res = await fetch(`/api/transitions/${params.id}/intake/prefill`, { method: 'POST' });
    setPrefilling(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Failed to prepopulate from documents.');
      return;
    }
    const body = await res.json();
    setPrefillNote(body.note ?? `Filled ${body.filled} of ${data?.questions.length ?? 0} question(s) from ${body.documentsUsed} document(s). Review and confirm each before relying on it.`);
    await load();
  }

  const totalAnswered = data ? data.progress.reduce((s, p) => s + p.answered, 0) : 0;
  const totalConfirmed = data ? data.progress.reduce((s, p) => s + p.confirmed, 0) : 0;
  const totalQuestions = data?.questions.length ?? 0;
  const pct = totalQuestions ? Math.round((totalConfirmed / totalQuestions) * 100) : 0;

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 17, margin: '0 0 4px' }}>Sales-to-Delivery Handoff Assessment</h2>
        <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 12px' }}>
          Answer by typing or using the microphone. Each answer feeds the delivery classification — confirm high-impact
          ones before generating the plan.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <div style={{ flex: 1, height: 8, borderRadius: 999, background: 'var(--line)', overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: 'var(--teal)', transition: 'width .3s' }} />
          </div>
          <span style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
            {totalConfirmed}/{totalQuestions} confirmed · {totalAnswered}/{totalQuestions} answered
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={prepopulateFromDocuments} disabled={prefilling}>
            {prefilling ? 'Reading documents…' : '✨ Prepopulate from documents'}
          </button>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>
            {documentCount > 0 ? `${documentCount} document(s) attached to this project` : 'No documents attached yet — add some from the project overview page'}
          </span>
        </div>
        {prefillNote && (
          <div style={{ fontSize: 12, color: 'var(--teal-dark)', background: 'rgba(15,157,143,0.08)', border: '1px solid var(--line)', borderRadius: 8, padding: '8px 12px', marginTop: 8 }}>
            {prefillNote}
          </div>
        )}
      </div>

      {error && (
        <div role="alert" style={{ color: '#b42318', fontSize: 12, marginBottom: 12 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gap: 14 }}>
        {data?.questions.map((q, i) => (
          <QuestionCard
            key={q.key}
            index={i + 1}
            question={q}
            value={draft[q.key]}
            confirmed={data.confirmedKeys.includes(q.key)}
            saving={saving === q.key}
            transcriptOpen={transcriptFor === q.key}
            onOpenTranscript={() => setTranscriptFor(q.key)}
            onCloseTranscript={() => setTranscriptFor(null)}
            onChange={(v) => setDraft((d) => ({ ...d, [q.key]: v }))}
            onSave={(v, confirm, source) => saveAnswer(q, v, confirm, source)}
          />
        ))}
        {!data && <p style={{ color: 'var(--muted)', fontSize: 13 }}>Loading…</p>}
      </div>
    </div>
  );
}

function QuestionCard({
  index,
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
  index: number;
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
  const isAnswered = value !== undefined && value !== null && value !== '';

  return (
    <div
      className="card"
      style={{
        padding: 18,
        borderLeft: confirmed ? '3px solid var(--teal)' : '3px solid var(--line)',
      }}
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div
          style={{
            flexShrink: 0,
            width: 26,
            height: 26,
            borderRadius: '50%',
            background: confirmed ? 'var(--teal)' : isAnswered ? 'rgba(15,157,143,0.15)' : 'var(--bg)',
            border: confirmed ? 'none' : '1px solid var(--line)',
            color: confirmed ? 'white' : 'var(--muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 800,
          }}
        >
          {confirmed ? '✓' : index}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
            <label style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.4 }}>
              {question.prompt}
              {question.required && <span style={{ color: '#b42318' }}> *</span>}
            </label>
            {supported && question.responseType === 'text' && (
              <button type="button" className="btn" onClick={start} aria-label={`Record answer for ${question.prompt}`} style={{ fontSize: 11, flexShrink: 0 }}>
                {recording ? '● Recording…' : '🎙 Record'}
              </button>
            )}
          </div>

          {(question.primaryRespondent || question.classificationSignal) && (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 10.5, color: 'var(--muted)', margin: '4px 0 10px' }}>
              {question.primaryRespondent && (
                <span>
                  👤 <strong style={{ color: 'var(--ink)', fontWeight: 600 }}>{question.primaryRespondent}</strong>
                </span>
              )}
              {question.classificationSignal && (
                <span>
                  🎯 {question.classificationSignal}
                </span>
              )}
            </div>
          )}
          {question.helpText && <p style={{ fontSize: 11, color: 'var(--muted)', margin: '0 0 8px' }}>{question.helpText}</p>}

          {transcriptOpen ? (
            <div>
              <textarea className="input" rows={3} value={transcript} onChange={(e) => setTranscript(e.target.value)} aria-label="Editable transcript" />
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
            <QuestionInput question={question} value={value} onChange={onChange} />
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
            <button className="btn" disabled={saving} onClick={() => onSave(value, false)}>
              Save
            </button>
            <button className="btn btn-primary" disabled={saving} onClick={() => onSave(value, true)}>
              {confirmed ? '✓ Confirmed' : 'Confirm'}
            </button>
            {question.highImpact && !confirmed && <span className="badge" style={{ fontSize: 9 }}>High impact — confirm before submitting</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
