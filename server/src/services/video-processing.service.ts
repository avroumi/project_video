import {
  getProcessingJob,
  updateProcessingJob,
} from "./video.service.js";

import { generateShorts } from "./clip-generation.service.js";

import {
  extractAudio,
  probeVideo,
} from "./ffmpeg.service.js";

import { transcribeAudio } from "./transcription.service.js";

import { analyzeTranscriptForClips } from "./clip-analysis.service.js";

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
     * Probe metadata
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

    updateProcessingJob(
      jobId,
      {
        status: "audio_ready",

        audioPath:
          audioResult.audioPath,
      },
    );

    /*
     * STEP 4
     * Transcription
     */

    updateProcessingJob(
      jobId,
      {
        status: "transcribing",
      },
    );

    const transcriptionResult =
      await transcribeAudio(
        audioResult.audioPath,
        job.id,
      );

    updateProcessingJob(
      jobId,
      {
        status:
          "transcript_ready",

        transcriptPath:
          transcriptionResult
            .transcriptPath,

        transcriptLanguage:
          transcriptionResult
            .transcript.language,

        transcriptDurationSeconds:
          transcriptionResult
            .transcript
            .durationSeconds,

        transcriptSegmentCount:
          transcriptionResult
            .transcript
            .segments.length,

        transcriptWordCount:
          transcriptionResult
            .transcript
            .words.length,
      },
    );

    /*
     * STEP 5
     * AI clip analysis
     */

    updateProcessingJob(
      jobId,
      {
        status:
          "analyzing_clips",
      },
    );

    const analysisResult =
      await analyzeTranscriptForClips(
        transcriptionResult
          .transcriptPath,
        job.id,
      );

    /*
     * Current end of pipeline
     */

    updateProcessingJob(
      jobId,
      {
        status: "clips_ready",

        analysisPath:
          analysisResult
            .analysisPath,

        clipCandidateCount:
          analysisResult
            .clips.length,
      },
    );
    /*
 * STEP 6
 * Generate real vertical shorts
 */

updateProcessingJob(
  jobId,
  {
    status:
      "generating_shorts",
  },
);

const generationResult =
  await generateShorts(
    downloadResult.videoPath,

    analysisResult.clips,

    job.id,
  );

/*
 * Current end of pipeline
 */

updateProcessingJob(
  jobId,
  {
    status: "shorts_ready",

    shortsManifestPath:
      generationResult
        .manifestPath,

    generatedShortCount:
      generationResult
        .shorts.length,
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