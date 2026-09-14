import { AnthropicDocumentIntakeExtractor } from './anthropic';
import { NoOpDocumentIntakeExtractor } from './mock';
import type { DocumentIntakeExtractor } from './types';

export * from './types';
export { AnthropicDocumentIntakeExtractor, NoOpDocumentIntakeExtractor };

export function getDocumentIntakeExtractor(): DocumentIntakeExtractor {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    return new AnthropicDocumentIntakeExtractor(apiKey, process.env.ANTHROPIC_MODEL || 'claude-sonnet-5');
  }
  return new NoOpDocumentIntakeExtractor();
}
