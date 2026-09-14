import type { DocumentIntakeExtractor, ExtractedAnswer, ExtractionDocument, ExtractionQuestion } from './types';

/**
 * No ANTHROPIC_API_KEY is configured in this environment, so this adapter
 * makes no suggestions rather than fabricating answers. The intake form
 * remains fully usable by hand.
 */
export class NoOpDocumentIntakeExtractor implements DocumentIntakeExtractor {
  async extract(_input: { documents: ExtractionDocument[]; questions: ExtractionQuestion[] }): Promise<Record<string, ExtractedAnswer>> {
    return {};
  }
}
