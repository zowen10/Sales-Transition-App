import type { AudioInput, TranscriptionProvider, TranscriptionResult } from './types';

/**
 * Local development/test provider. Real speech-to-text is not configured
 * in this environment (no TRANSCRIPTION_PROVIDER credential was supplied),
 * so this mock stands in for the interface: it never fabricates content —
 * if the caller supplies `hintText` (used by tests and by browser-side
 * Web Speech API results relayed from the client) it is echoed back as the
 * transcript; otherwise it returns an empty, zero-confidence result so the
 * UI prompts the user to type the answer instead.
 */
export class MockTranscriptionProvider implements TranscriptionProvider {
  async transcribe(input: AudioInput & { hintText?: string }): Promise<TranscriptionResult> {
    if (input.hintText && input.hintText.trim().length > 0) {
      return { transcript: input.hintText.trim(), confidence: 0.92, provider: 'mock', durationMs: 0 };
    }
    return { transcript: '', confidence: 0, provider: 'mock' };
  }
}
