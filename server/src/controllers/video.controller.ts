import type { Request, Response } from "express";

import { createProcessingJob } from "../services/video.service";

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
    const job = createProcessingJob(body.url);

    res.status(201).json({
      job,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "INVALID_YOUTUBE_URL"
    ) {
      res.status(400).json({
        error: "The provided URL is not a valid YouTube URL.",
      });

      return;
    }

    console.error(error);

    res.status(500).json({
      error: "Internal server error.",
    });
  }
}