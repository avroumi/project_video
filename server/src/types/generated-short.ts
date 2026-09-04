export interface GeneratedShort {
  id: string;

  start: number;
  end: number;
  durationSeconds: number;

  title: string;
  hook: string;
  score: number;
  reason: string;

  videoPath: string;

  width: number;
  height: number;
}

export interface GeneratedShortManifest {
  shorts: GeneratedShort[];
}