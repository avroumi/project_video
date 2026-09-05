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

  reframeStrategy:
    | "dynamic_face"
    | "center";

  reframeDetectionRate: number;
  reframePointCount: number;

  videoUrl: string;
}