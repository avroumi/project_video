import { randomUUID } from "node:crypto";

import type {
  ProcessingJob,
  ProcessingStatus,
} from "../types/processing-job.js";

import type { VideoMetadata } from "../types/video-metadata.js";

const jobs = new Map<string, ProcessingJob>();

const YOUTUBE_HOSTNAMES = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
]);

function isYouTubeUrl(value: string): boolean {
  try {
    const url = new URL(value);

    return (
      (url.protocol === "https:" ||
        url.protocol === "http:") &&
      YOUTUBE_HOSTNAMES.has(
        url.hostname.toLowerCase(),
      )
    );
  } catch {
    return false;
  }
}

export function createProcessingJob(
  sourceUrl: string,
): ProcessingJob {
  const normalizedUrl = sourceUrl.trim();

  if (!isYouTubeUrl(normalizedUrl)) {
    throw new Error("INVALID_YOUTUBE_URL");
  }

  const now = new Date().toISOString();

  const job: ProcessingJob = {
    id: randomUUID(),
    sourceUrl: normalizedUrl,
    status: "queued",
    createdAt: now,
    updatedAt: now,
  };

  jobs.set(job.id, job);

  return job;
}

export function getProcessingJob(
  jobId: string,
): ProcessingJob | undefined {
  return jobs.get(jobId);
}

interface UpdateProcessingJobInput {
  status?: ProcessingStatus;

  videoPath?: string;
  audioPath?: string;

  metadata?: VideoMetadata;

  transcriptPath?: string;

  transcriptLanguage?: string;
  transcriptDurationSeconds?: number;

  transcriptSegmentCount?: number;
  transcriptWordCount?: number;

  error?: string;
}

export function updateProcessingJob(
  jobId: string,
  updates: UpdateProcessingJobInput,
): ProcessingJob {
  const existingJob = jobs.get(jobId);

  if (!existingJob) {
    throw new Error("JOB_NOT_FOUND");
  }

  const updatedJob: ProcessingJob = {
    ...existingJob,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  jobs.set(jobId, updatedJob);

  return updatedJob;
}