import type { VideoMetadata } from "./video-metadata.js";

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
  | "failed";

export interface ProcessingJob {
  id: string;
  sourceUrl: string;

  status: ProcessingStatus;

  createdAt: string;
  updatedAt: string;

  videoPath?: string;
  audioPath?: string;

  metadata?: VideoMetadata;

  transcriptPath?: string;

  transcriptLanguage?: string;
  transcriptDurationSeconds?: number;

  transcriptSegmentCount?: number;
  transcriptWordCount?: number;

  analysisPath?: string;
  clipCandidateCount?: number;

  error?: string;
}