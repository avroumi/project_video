export type ReframeStrategy =
  | "dynamic_face"
  | "center";

export interface ReframeTrackPoint {
  time: number;
  focusX: number;
}

export interface ReframeTrack {
  strategy: ReframeStrategy;

  durationSeconds: number;

  sampleCount: number;
  detectionCount: number;
  acceptedCount: number;

  detectionRate: number;

  points: ReframeTrackPoint[];
}