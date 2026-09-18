import type { ScenarioChatAdapter, ScenarioChatContext, ScenarioChatReply } from './types';

/** Used when ANTHROPIC_API_KEY isn't configured — explains the limitation rather than silently doing nothing. */
export class NoOpScenarioChatAdapter implements ScenarioChatAdapter {
  async sendMessage(_userMessage: string, _context: ScenarioChatContext): Promise<ScenarioChatReply> {
    return {
      message:
        "Conversational scenario editing isn't configured in this environment (no ANTHROPIC_API_KEY). Use the lever sidebar to make changes directly.",
      proposedChange: null,
    };
  }
}
