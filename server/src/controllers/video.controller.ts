import type {
  Request,
  Response,
} from "express";
import {
  getShortManifest,
  getShortVideoPath,
} from "../services/short.service.js";
import { generateYouTubeMetadata } from "../services/youtube-metadata.service.js";

import {
  createProcessingJob,
  getProcessingJob,
} from "../services/video.service.js";

import { startVideoProcessing } from "../services/video-processing.service.js";

interface CreateVideoRequestBody {
  url: string;
}

function isCreateVideoRequestBody(
  body: unknown,
): body is CreateVideoRequestBody {
  if (
    typeof body !== "object" ||
    body === null ||
    !("url" in body)
  ) {
    return false;
  }

  return typeof body.url === "string";
}

export function createVideoJobController(
  req: Request,
  res: Response,
): void {
  const body: unknown = req.body;

  if (!isCreateVideoRequestBody(body)) {
    res.status(400).json({
      error: "A YouTube URL is required.",
    });

    return;
  }

  try {
    const job =
      createProcessingJob(body.url);

    void startVideoProcessing(job.id);

    res.status(202).json({
      job,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message ===
        "INVALID_YOUTUBE_URL"
    ) {
      res.status(400).json({
        error:
          "The provided URL is not a valid YouTube URL.",
      });

      return;
    }

    console.error(error);

    res.status(500).json({
      error: "Internal server error.",
    });
  }
}

export function getVideoJobController(
  req: Request<{ jobId: string }>,
  res: Response,
): void {
  const job =
    getProcessingJob(req.params.jobId);

  if (!job) {
    res.status(404).json({
      error: "Processing job not found.",
    });

    return;
  }

  res.status(200).json({
    job,
  });
}
export async function getVideoShorts(
  req: Request,
  res: Response,
): Promise<void> {
  const { jobId } =
    req.params;

  if (
    typeof jobId !== "string"
  ) {
    res.status(400).json({
      error:
        "JOB_ID_REQUIRED",
    });

    return;
  }

  try {
    const manifest =
      await getShortManifest(
        jobId,
      );

    const shorts =
      manifest.shorts.map(
        (short) => ({
          ...short,

          videoUrl:
            `/api/videos/${jobId}/shorts/${short.id}/video`,
        }),
      );

    res.json({
      shorts,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "UNKNOWN_ERROR";

    if (
      message ===
      "SHORT_MANIFEST_NOT_FOUND"
    ) {
      res.status(404).json({
        error: message,
      });

      return;
    }

    if (
      message ===
      "INVALID_JOB_ID"
    ) {
      res.status(400).json({
        error: message,
      });

      return;
    }

    console.error(
      "Unable to retrieve shorts:",
      error,
    );

    res.status(500).json({
      error:
        "UNABLE_TO_RETRIEVE_SHORTS",
    });
  }
}
export async function streamShortVideo(
  req: Request,
  res: Response,
): Promise<void> {
  const {
    jobId,
    shortId,
  } = req.params;

  if (
    typeof jobId !== "string" ||
    typeof shortId !== "string"
  ) {
    res.status(400).json({
      error:
        "JOB_ID_AND_SHORT_ID_REQUIRED",
    });

    return;
  }

  try {
    const absoluteVideoPath =
      await getShortVideoPath(
        jobId,
        shortId,
      );

    res.sendFile(
      absoluteVideoPath,
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "UNKNOWN_ERROR";

    if (
      message === "SHORT_NOT_FOUND" ||
      message === "SHORT_VIDEO_NOT_FOUND" ||
      message === "SHORT_MANIFEST_NOT_FOUND"
    ) {
      res.status(404).json({
        error: message,
      });

      return;
    }

    if (
      message === "INVALID_JOB_ID" ||
      message === "INVALID_SHORT_ID"
    ) {
      res.status(400).json({
        error: message,
      });

      return;
    }

    console.error(
      "Unable to stream short:",
      error,
    );

    res.status(500).json({
      error:
        "UNABLE_TO_STREAM_SHORT",
    });
  }
}export async function createShortMetadata(
  req: Request,
  res: Response,
): Promise<void> {
  const {
    jobId,
    shortId,
  } = req.params;

  if (
    typeof jobId !== "string" ||
    typeof shortId !== "string"
  ) {
    res.status(400).json({
      error:
        "JOB_ID_AND_SHORT_ID_REQUIRED",
    });

    return;
  }

  try {
    const result =
      await generateYouTubeMetadata(
        jobId,
        shortId,
      );

    res.json(result);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "UNKNOWN_ERROR";

    if (
      message ===
        "SHORT_NOT_FOUND" ||
      message ===
        "SHORT_MANIFEST_NOT_FOUND" ||
      message ===
        "TRANSCRIPT_NOT_FOUND"
    ) {
      res.status(404).json({
        error: message,
      });

      return;
    }

    if (
      message ===
        "INVALID_JOB_ID" ||
      message ===
        "INVALID_SHORT_ID" ||
      message ===
        "SHORT_TRANSCRIPT_EMPTY"
    ) {
      res.status(400).json({
        error: message,
      });

      return;
    }

    console.error(
      "Unable to generate YouTube metadata:",
      error,
    );

    res.status(500).json({
      error:
        "UNABLE_TO_GENERATE_METADATA",
    });
  }
}