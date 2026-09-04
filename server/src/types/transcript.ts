export interface TranscriptSegment {
  id: number;
  start: number;
  end: number;
  text: string;
}

export interface TranscriptWord {
  word: string;
  start: number;
  end: number;
}

export interface Transcript {
  text: string;
  language: string;
  durationSeconds: number;

  segments: TranscriptSegment[];
  words: TranscriptWord[];
}