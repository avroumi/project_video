import { randomUUID } from "node:crypto";

import type { ProcessingJob } from "../types/processing-job";

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
      (url.protocol === "https:" || url.protocol === "http:") &&
      YOUTUBE_HOSTNAMES.has(url.hostname.toLowerCase())
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

  const job: ProcessingJob = {
    id: randomUUID(),
    sourceUrl: normalizedUrl,
    status: "queued",
    createdAt: new Date().toISOString(),
  };

  jobs.set(job.id, job);

  return job;
}