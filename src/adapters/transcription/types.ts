export interface AudioInput {
  /** Base64-encoded audio, or a URL to a short-lived, permissioned blob. Never a raw file path on disk. */
  audioBase64?: string;
  audioUrl?: string;
  mimeType: string;
  /** Question this recording answers, for provider-side context/prompting. */
  questionPrompt?: string;
}

export interface TranscriptionResult {
  transcript: string;
  confidence: number; // 0-1
  provider: string;
  durationMs?: number;
}

/**
 * Transcription is a swappable adapter — the UI and intake service depend
 * only on this interface, never on a vendor SDK. Transcripts are always
 * surfaced back to the user as editable text before being normalized and
 * saved; the provider never writes directly to an answer.
 */
export interface TranscriptionProvider {
  transcribe(input: AudioInput): Promise<TranscriptionResult>;
}
