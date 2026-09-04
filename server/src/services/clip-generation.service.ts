import {
  mkdir,
  writeFile,
} from "node:fs/promises";

import path from "node:path";

import type { ClipCandidate } from "../types/clip-candidate.js";

import type {
  GeneratedShort,
  GeneratedShortManifest,
} from "../types/generated-short.js";

import type { Transcript } from "../types/transcript.js";

import { generateVerticalClip } from "./ffmpeg.service.js";

import { detectReframeTrack } from "./reframe.service.js";

import { createAssSubtitlesForClip } from "./subtitle.service.js";

interface GenerateShortsResult {
  shorts: GeneratedShort[];
  manifestPath: string;
}

function createShortId(
  index: number,
): string {
  return `short-${String(
    index + 1,
  ).padStart(2, "0")}`;
}

export async function generateShorts(
  videoPath: string,
  clips: ClipCandidate[],
  transcript: Transcript,
  jobId: string,
): Promise<GenerateShortsResult> {
  if (
    clips.length === 0
  ) {
    throw new Error(
      "NO_CLIPS_TO_GENERATE",
    );
  }

  const outputDirectory =
    path.resolve(
      process.cwd(),
      "storage",
      "shorts",
      jobId,
    );

  await mkdir(
    outputDirectory,
    {
      recursive: true,
    },
  );

  const generatedShorts:
    GeneratedShort[] = [];

  for (
    let index = 0;
    index < clips.length;
    index += 1
  ) {
    const clip =
      clips[index];

    if (!clip) {
      continue;
    }

    const shortId =
      createShortId(
        index,
      );

    console.log(
      `Generating ${shortId}: ${clip.start}s → ${clip.end}s`,
    );

    /*
     * STEP 1
     *
     * Detect face trajectory.
     */
    const reframeTrack =
      await detectReframeTrack({
        videoPath,

        start:
          clip.start,

        end:
          clip.end,

        interval:
          0.75,
      });

    console.log(
      [
        `${shortId} tracking:`,
        `strategy=${reframeTrack.strategy}`,
        `detections=${reframeTrack.detectionCount}/${reframeTrack.sampleCount}`,
        `accepted=${reframeTrack.acceptedCount}`,
        `points=${reframeTrack.points.length}`,
      ].join(" "),
    );

    /*
     * STEP 2
     *
     * Build subtitles.
     */
    const subtitleResult =
      await createAssSubtitlesForClip(
        transcript,
        clip,
        jobId,
        shortId,
      );

    const relativeVideoPath =
      path.join(
        "storage",
        "shorts",
        jobId,
        `${shortId}.mp4`,
      );

    /*
     * STEP 3
     *
     * Render dynamic crop +
     * subtitles.
     */
    await generateVerticalClip({
      videoPath,

      outputPath:
        relativeVideoPath,

      start:
        clip.start,

      end:
        clip.end,

      reframeTrack,

      subtitlePath:
        subtitleResult
          .subtitlePath,
    });

    /*
     * STEP 4
     *
     * Store generated Short metadata.
     */
    generatedShorts.push({
      id:
        shortId,

      start:
        clip.start,

      end:
        clip.end,

      durationSeconds:
        clip.end -
        clip.start,

      title:
        clip.title,

      hook:
        clip.hook,

      score:
        clip.score,

      reason:
        clip.reason,

      videoPath:
        relativeVideoPath,

      subtitlePath:
        subtitleResult
          .subtitlePath,

      subtitleCueCount:
        subtitleResult
          .cueCount,

      width:
        1080,

      height:
        1920,

      reframeStrategy:
        reframeTrack
          .strategy,

      reframeDetectionRate:
        reframeTrack
          .detectionRate,

      reframePointCount:
        reframeTrack
          .points.length,
    });
  }

  const manifest:
    GeneratedShortManifest = {
      shorts:
        generatedShorts,
    };

  const absoluteManifestPath =
    path.join(
      outputDirectory,
      "shorts.json",
    );

  await writeFile(
    absoluteManifestPath,

    JSON.stringify(
      manifest,
      null,
      2,
    ),

    "utf8",
  );

  return {
    shorts:
      generatedShorts,

    manifestPath:
      path.relative(
        process.cwd(),
        absoluteManifestPath,
      ),
  };
}