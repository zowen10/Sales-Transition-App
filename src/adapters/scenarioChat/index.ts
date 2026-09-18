import { AnthropicScenarioChatAdapter } from './anthropic';
import { NoOpScenarioChatAdapter } from './mock';
import type { ScenarioChatAdapter } from './types';

export * from './types';
export { AnthropicScenarioChatAdapter, NoOpScenarioChatAdapter };

export function getScenarioChatAdapter(): ScenarioChatAdapter {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    return new AnthropicScenarioChatAdapter(apiKey, process.env.ANTHROPIC_MODEL || 'claude-sonnet-5');
  }
  return new NoOpScenarioChatAdapter();
}
