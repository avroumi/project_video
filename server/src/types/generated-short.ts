import type { ReframeStrategy } from "./reframe-focus.js";

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

  subtitlePath: string;
  subtitleCueCount: number;

  width: number;
  height: number;

  reframeStrategy: ReframeStrategy;
  reframeDetectionRate: number;
  reframePointCount: number;
}

export interface GeneratedShortManifest {
  shorts: GeneratedShort[];
}