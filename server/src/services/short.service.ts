import {
  access,
  readFile,
} from "node:fs/promises";

import path from "node:path";

import type {
  GeneratedShort,
  GeneratedShortManifest,
} from "../types/generated-short.js";

function isObject(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null
  );
}

function isGeneratedShort(
  value: unknown,
): value is GeneratedShort {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.start === "number" &&
    typeof value.end === "number" &&
    typeof value.durationSeconds === "number" &&
    typeof value.title === "string" &&
    typeof value.hook === "string" &&
    typeof value.score === "number" &&
    typeof value.reason === "string" &&
    typeof value.videoPath === "string" &&
    typeof value.subtitlePath === "string" &&
    typeof value.subtitleCueCount === "number" &&
    typeof value.width === "number" &&
    typeof value.height === "number"
  );
}

function isGeneratedShortManifest(
  value: unknown,
): value is GeneratedShortManifest {
  if (!isObject(value)) {
    return false;
  }

  if (!Array.isArray(value.shorts)) {
    return false;
  }

  return value.shorts.every(
    isGeneratedShort,
  );
}

function validateJobId(
  jobId: string,
): void {
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuidPattern.test(jobId)) {
    throw new Error(
      "INVALID_JOB_ID",
    );
  }
}

function validateShortId(
  shortId: string,
): void {
  const shortIdPattern =
    /^short-\d{2,3}$/;

  if (
    !shortIdPattern.test(
      shortId,
    )
  ) {
    throw new Error(
      "INVALID_SHORT_ID",
    );
  }
}

export async function getShortManifest(
  jobId: string,
): Promise<GeneratedShortManifest> {
  validateJobId(
    jobId,
  );

  const manifestPath =
    path.resolve(
      process.cwd(),
      "storage",
      "shorts",
      jobId,
      "shorts.json",
    );

  let manifestFile: string;

  try {
    manifestFile =
      await readFile(
        manifestPath,
        "utf8",
      );
  } catch {
    throw new Error(
      "SHORT_MANIFEST_NOT_FOUND",
    );
  }

  let parsedManifest: unknown;

  try {
    parsedManifest =
      JSON.parse(
        manifestFile,
      );
  } catch {
    throw new Error(
      "SHORT_MANIFEST_INVALID_JSON",
    );
  }

  if (
    !isGeneratedShortManifest(
      parsedManifest,
    )
  ) {
    throw new Error(
      "SHORT_MANIFEST_INVALID_STRUCTURE",
    );
  }

  return parsedManifest;
}

export async function getShortVideoPath(
  jobId: string,
  shortId: string,
): Promise<string> {
  validateJobId(
    jobId,
  );

  validateShortId(
    shortId,
  );

  const manifest =
    await getShortManifest(
      jobId,
    );

  const short =
    manifest.shorts.find(
      (candidate) =>
        candidate.id ===
        shortId,
    );

  if (!short) {
    throw new Error(
      "SHORT_NOT_FOUND",
    );
  }

  const absoluteVideoPath =
    path.resolve(
      process.cwd(),
      short.videoPath,
    );

  try {
    await access(
      absoluteVideoPath,
    );
  } catch {
    throw new Error(
      "SHORT_VIDEO_NOT_FOUND",
    );
  }

  return absoluteVideoPath;
}