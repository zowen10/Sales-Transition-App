import type { DocumentIntakeExtractor, ExtractedAnswer, ExtractionDocument, ExtractionQuestion } from './types';

const MAX_CHARS_PER_DOC = 15000;
const MAX_TOTAL_CHARS = 45000;

function buildDocumentContext(documents: ExtractionDocument[]): string {
  let remaining = MAX_TOTAL_CHARS;
  const parts: string[] = [];
  for (const doc of documents) {
    if (remaining <= 0) break;
    const text = doc.text.slice(0, Math.min(MAX_CHARS_PER_DOC, remaining));
    remaining -= text.length;
    parts.push(`--- Document: ${doc.filename} ---\n${text}`);
  }
  return parts.join('\n\n');
}

/**
 * Uses the Anthropic Messages API to suggest answers to intake questions
 * from attached document text. Every suggestion is returned with a
 * confidence score and is written back unconfirmed — the model never
 * writes directly to an answer. If a question has no support in the
 * documents, the model is instructed to omit it rather than guess.
 */
export class AnthropicDocumentIntakeExtractor implements DocumentIntakeExtractor {
  constructor(private readonly apiKey: string, private readonly model: string) {}

  async extract(input: { documents: ExtractionDocument[]; questions: ExtractionQuestion[] }): Promise<Record<string, ExtractedAnswer>> {
    if (!input.documents.length || !input.questions.length) return {};

    const documentContext = buildDocumentContext(input.documents);
    const questionList = input.questions.map((q) => `- key: "${q.key}"\n  question: ${q.prompt}`).join('\n');

    const prompt = `You are extracting facts from sales handoff documents to help pre-fill an intake form. You are NOT allowed to guess or infer beyond what the text actually supports.

Documents:
${documentContext}

Questions to answer strictly from the documents above:
${questionList}

For each question where the documents contain a direct, supportable answer, include it in your response. Omit any question the documents do not address — do not fabricate or infer an answer with no textual basis.

Respond with ONLY a JSON object (no markdown fences, no commentary) shaped exactly like:
{"<question key>": {"value": "<concise answer drawn from the text>", "confidence": <0 to 1 number>}}`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      throw new Error(`Anthropic API error: ${res.status} ${res.statusText}`);
    }

    const body = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = body.content?.find((c) => c.type === 'text')?.text ?? '{}';

    let parsed: Record<string, { value?: unknown; confidence?: unknown }>;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    } catch {
      return {};
    }

    const validKeys = new Set(input.questions.map((q) => q.key));
    const result: Record<string, ExtractedAnswer> = {};
    for (const [key, raw] of Object.entries(parsed)) {
      if (!validKeys.has(key)) continue;
      if (typeof raw?.value !== 'string' || !raw.value.trim()) continue;
      const confidence = typeof raw.confidence === 'number' ? Math.max(0, Math.min(1, raw.confidence)) : 0.5;
      result[key] = { value: raw.value.trim(), confidence };
    }
    return result;
  }
}
