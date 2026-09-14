import { MockTranscriptionProvider } from './mock';
import type { TranscriptionProvider } from './types';

export * from './types';
export { MockTranscriptionProvider };

/**
 * Provider selection is environment-driven so a real vendor can be plugged
 * in later without touching intake service or UI code. No real vendor is
 * wired up in this build — TRANSCRIPTION_PROVIDER unset or "mock" always
 * resolves to the local mock.
 */
export function getTranscriptionProvider(): TranscriptionProvider {
  const provider = process.env.TRANSCRIPTION_PROVIDER ?? 'mock';
  switch (provider) {
    case 'mock':
    default:
      return new MockTranscriptionProvider();
  }
}
