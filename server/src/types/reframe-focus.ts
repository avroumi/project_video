export type ReframeStrategy =
  | "face"
  | "center";

export interface ReframeFocus {
  strategy: ReframeStrategy;

  focusX: number;
  focusY: number;

  faceWidthRatio: number;
  faceHeightRatio: number;

  sampleCount: number;
  detectionCount: number;
}

export interface AppliedReframe {
  strategy: ReframeStrategy;

  focusX: number;
  focusY: number;

  safeFocusY: number;

  zoom: number;

  cropX: number;
  cropY: number;

  cropWidth: number;
  cropHeight: number;
}