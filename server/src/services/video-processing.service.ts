import {
  getProcessingJob,
  updateProcessingJob,
} from "./video.service.js";

import {
  extractAudio,
  probeVideo,
} from "./ffmpeg.service.js";

import { downloadYouTubeVideo } from "./ytdlp.service.js";

export async function startVideoProcessing(
  jobId: string,
): Promise<void> {
  const job =
    getProcessingJob(jobId);

  if (!job) {
    return;
  }

  try {
    /*
     * STEP 1
     * Download video
     */

    updateProcessingJob(
      jobId,
      {
        status: "downloading",
      },
    );

    const downloadResult =
      await downloadYouTubeVideo(
        job.sourceUrl,
        job.id,
      );

    /*
     * STEP 2
     * Read video metadata
     */

    updateProcessingJob(
      jobId,
      {
        status: "probing",

        videoPath:
          downloadResult.videoPath,
      },
    );

    const metadata =
      await probeVideo(
        downloadResult.videoPath,
      );

    /*
     * STEP 3
     * Extract audio
     */

    updateProcessingJob(
      jobId,
      {
        status:
          "extracting_audio",

        metadata,
      },
    );

    const audioResult =
      await extractAudio(
        downloadResult.videoPath,
        job.id,
      );

    /*
     * Pipeline currently finished here
     */

    updateProcessingJob(
      jobId,
      {
        status: "audio_ready",

        audioPath:
          audioResult.audioPath,
      },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown video processing error.";

    console.error(
      `Processing job ${jobId} failed:`,
      message,
    );

    updateProcessingJob(
      jobId,
      {
        status: "failed",
        error: message,
      },
    );
  }
}