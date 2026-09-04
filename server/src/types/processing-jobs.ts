export type ProcessingStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed";

export interface ProcessingJob {
  id: string;
  sourceUrl: string;
  status: ProcessingStatus;
  createdAt: string;
}