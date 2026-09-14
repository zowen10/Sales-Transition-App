export interface ExtractionQuestion {
  key: string;
  prompt: string;
}

export interface ExtractionDocument {
  filename: string;
  text: string;
}

export interface ExtractedAnswer {
  value: string;
  confidence: number; // 0-1
}

/**
 * Reads attached document text and suggests answers to intake questions.
 * Every suggestion is written back as an UNCONFIRMED, editable answer
 * (source: 'imported') — this adapter never writes anything the user
 * hasn't had a chance to review. It only ever draws on the document text
 * it's given; it does not invent values for questions the documents don't
 * address.
 */
export interface DocumentIntakeExtractor {
  extract(input: { documents: ExtractionDocument[]; questions: ExtractionQuestion[] }): Promise<Record<string, ExtractedAnswer>>;
}
