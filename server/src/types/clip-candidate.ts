export interface ClipCandidate {
  start: number;
  end: number;

  title: string;
  hook: string;

  score: number;

  reason: string;
}

export interface ClipAnalysis {
  clips: ClipCandidate[];
}