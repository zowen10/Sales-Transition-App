import { AnthropicColumnMappingAdapter } from './anthropic';
import { MockColumnMappingAdapter } from './mock';
import type { ColumnMappingAdapter } from './types';

export * from './types';
export { AnthropicColumnMappingAdapter, MockColumnMappingAdapter };

export function getColumnMappingAdapter(): ColumnMappingAdapter {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    return new AnthropicColumnMappingAdapter(apiKey, process.env.ANTHROPIC_MODEL || 'claude-sonnet-5');
  }
  return new MockColumnMappingAdapter();
}
