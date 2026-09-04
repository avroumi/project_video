export interface VideoMetadata {
  durationSeconds: number;
  width: number;
  height: number;
  fps: number;
  formatName?: string;
  fileSizeBytes?: number;
  videoCodec?: string;
  audioCodec?: string;
}