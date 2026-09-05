export type ProcessingStatus =
  | "queued"
  | "downloading"
  | "probing"
  | "extracting_audio"
  | "audio_ready"
  | "transcribing"
  | "transcript_ready"
  | "analyzing_clips"
  | "clips_ready"
  | "generating_shorts"
  | "shorts_ready"
  | "failed";

export interface ProcessingJob {
  id: string;

  sourceUrl: string;

  status: ProcessingStatus;

  createdAt: string;
  updatedAt: string;

  error?: string;
}