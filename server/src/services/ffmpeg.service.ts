import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";

import type { ReframeTrack } from "../types/reframe-focus.js";
import type { VideoMetadata } from "../types/video-metadata.js";

interface FfprobeStream {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  avg_frame_rate?: string;
}

interface FfprobeFormat {
  duration?: string;
  size?: string;
  format_name?: string;
}

interface FfprobeOutput {
  streams?: FfprobeStream[];
  format?: FfprobeFormat;
}

interface ExtractAudioResult {
  audioPath: string;
}

interface GenerateVerticalClipInput {
  videoPath: string;
  outputPath: string;

  start: number;
  end: number;

  reframeTrack: ReframeTrack;

  subtitlePath?: string;
}

function isObject(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null
  );
}

function isFfprobeOutput(
  value: unknown,
): value is FfprobeOutput {
  if (!isObject(value)) {
    return false;
  }

  if (
    "streams" in value &&
    value.streams !== undefined &&
    !Array.isArray(value.streams)
  ) {
    return false;
  }

  if (
    "format" in value &&
    value.format !== undefined &&
    !isObject(value.format)
  ) {
    return false;
  }

  return true;
}

function parseFrameRate(
  value: string | undefined,
): number {
  if (!value) {
    return 0;
  }

  const [
    numeratorText,
    denominatorText,
  ] = value.split("/");

  const numerator =
    Number(numeratorText);

  const denominator =
    Number(denominatorText);

  if (
    !Number.isFinite(numerator) ||
    !Number.isFinite(denominator) ||
    denominator === 0
  ) {
    return 0;
  }

  return (
    numerator /
    denominator
  );
}

function escapeFfmpegFilterPath(
  value: string,
): string {
  return value
    .replaceAll(
      "\\",
      "\\\\",
    )
    .replaceAll(
      ":",
      "\\:",
    )
    .replaceAll(
      "'",
      "\\'",
    );
}

/*
 * A comma has a special meaning inside
 * a FFmpeg filter graph.
 *
 * Our mathematical expressions contain
 * functions such as:
 *
 * if(...)
 * min(...)
 * max(...)
 *
 * so their commas must be escaped.
 */
function escapeFfmpegExpression(
  value: string,
): string {
  return value.replaceAll(
    ",",
    "\\,",
  );
}

function formatExpressionNumber(
  value: number,
): string {
  return value.toFixed(6);
}

/*
 * Convert:
 *
 * [
 *   { time: 0, focusX: 0.37 },
 *   { time: 1, focusX: 0.40 },
 *   { time: 2, focusX: 0.50 }
 * ]
 *
 * into a FFmpeg expression based on t.
 *
 * Between two points we use linear
 * interpolation, so the crop moves
 * progressively instead of jumping.
 */
function buildFocusXExpression(
  track: ReframeTrack,
): string {
  if (
    track.strategy === "center" ||
    track.points.length < 2
  ) {
    return "0.5";
  }

  const points =
    track.points;

  const lastPoint =
    points[
      points.length - 1
    ];

  if (!lastPoint) {
    return "0.5";
  }

  let expression =
    formatExpressionNumber(
      lastPoint.focusX,
    );

  /*
   * We build nested if() expressions
   * backwards.
   */
  for (
    let index =
      points.length - 2;
    index >= 0;
    index -= 1
  ) {
    const current =
      points[index];

    const next =
      points[index + 1];

    if (
      !current ||
      !next
    ) {
      continue;
    }

    const segmentDuration =
      Math.max(
        next.time -
          current.time,
        0.001,
      );

    const currentTime =
      formatExpressionNumber(
        current.time,
      );

    const nextTime =
      formatExpressionNumber(
        next.time,
      );

    const currentX =
      formatExpressionNumber(
        current.focusX,
      );

    const nextX =
      formatExpressionNumber(
        next.focusX,
      );

    const duration =
      formatExpressionNumber(
        segmentDuration,
      );

    /*
     * Linear interpolation:
     *
     * x1 + (x2-x1) * (t-t1)/(t2-t1)
     */
    const interpolation =
      `${currentX}` +
      `+(${nextX}-${currentX})` +
      `*(t-${currentTime})` +
      `/${duration}`;

    expression =
      `if(` +
      `lt(t,${nextTime}),` +
      `${interpolation},` +
      `${expression}` +
      `)`;
  }

  return expression;
}

function buildCropXExpression(
  track: ReframeTrack,
): string {
  const focusExpression =
    buildFocusXExpression(
      track,
    );

  /*
   * focusX represents the desired
   * center of the crop.
   *
   * Example:
   *
   * focusX = 0.5
   * → center of source
   *
   * focusX = 0.7
   * → 70% across source width
   *
   * max/min prevent the crop from
   * leaving the source image.
   */
  return (
    "max(" +
    "0," +
    "min(" +
    "iw-ow," +
    `(${focusExpression})*iw-ow/2` +
    ")" +
    ")"
  );
}

export async function probeVideo(
  videoPath: string,
): Promise<VideoMetadata> {
  const absoluteVideoPath =
    path.resolve(
      process.cwd(),
      videoPath,
    );

  const args = [
    "-v",
    "error",

    "-print_format",
    "json",

    "-show_format",
    "-show_streams",

    absoluteVideoPath,
  ];

  return new Promise(
    (
      resolve,
      reject,
    ) => {
      const childProcess =
        spawn(
          "ffprobe",
          args,
          {
            shell: false,
          },
        );

      let stdout = "";
      let stderr = "";

      childProcess.stdout.on(
        "data",
        (
          data: Buffer,
        ) => {
          stdout +=
            data.toString();
        },
      );

      childProcess.stderr.on(
        "data",
        (
          data: Buffer,
        ) => {
          stderr +=
            data.toString();
        },
      );

      childProcess.on(
        "error",
        (
          error,
        ) => {
          reject(
            new Error(
              `Unable to start ffprobe: ${error.message}`,
            ),
          );
        },
      );

      childProcess.on(
        "close",
        (
          exitCode,
        ) => {
          if (
            exitCode !== 0
          ) {
            reject(
              new Error(
                stderr.trim() ||
                  `ffprobe exited with code ${exitCode}`,
              ),
            );

            return;
          }

          try {
            const parsed: unknown =
              JSON.parse(
                stdout,
              );

            if (
              !isFfprobeOutput(
                parsed,
              )
            ) {
              throw new Error(
                "Invalid ffprobe response.",
              );
            }

            const videoStream =
              parsed.streams?.find(
                (
                  stream,
                ) =>
                  stream.codec_type ===
                  "video",
              );

            const audioStream =
              parsed.streams?.find(
                (
                  stream,
                ) =>
                  stream.codec_type ===
                  "audio",
              );

            if (
              !videoStream
            ) {
              throw new Error(
                "No video stream found.",
              );
            }

            const durationSeconds =
              Number(
                parsed.format
                  ?.duration,
              );

            if (
              !Number.isFinite(
                durationSeconds,
              )
            ) {
              throw new Error(
                "Unable to determine video duration.",
              );
            }

            const fileSize =
              parsed.format?.size
                ? Number(
                    parsed.format
                      .size,
                  )
                : undefined;

            const metadata:
              VideoMetadata = {
                durationSeconds,

                width:
                  videoStream
                    .width ?? 0,

                height:
                  videoStream
                    .height ?? 0,

                fps:
                  parseFrameRate(
                    videoStream
                      .avg_frame_rate,
                  ),

                formatName:
                  parsed.format
                    ?.format_name,

                videoCodec:
                  videoStream
                    .codec_name,

                audioCodec:
                  audioStream
                    ?.codec_name,
              };

            if (
              fileSize !==
                undefined &&
              Number.isFinite(
                fileSize,
              )
            ) {
              metadata.fileSizeBytes =
                fileSize;
            }

            resolve(
              metadata,
            );
          } catch (
            error
          ) {
            const message =
              error instanceof
              Error
                ? error.message
                : "Unable to parse ffprobe output.";

            reject(
              new Error(
                message,
              ),
            );
          }
        },
      );
    },
  );
}

export async function extractAudio(
  videoPath: string,
  jobId: string,
): Promise<ExtractAudioResult> {
  const absoluteVideoPath =
    path.resolve(
      process.cwd(),
      videoPath,
    );

  const outputDirectory =
    path.resolve(
      process.cwd(),
      "storage",
      "audio",
      jobId,
    );

  await mkdir(
    outputDirectory,
    {
      recursive: true,
    },
  );

  const absoluteAudioPath =
    path.join(
      outputDirectory,
      "audio.mp3",
    );

  const args = [
    "-y",

    "-i",
    absoluteVideoPath,

    "-vn",

    "-ac",
    "1",

    "-ar",
    "16000",

    "-c:a",
    "libmp3lame",

    "-b:a",
    "64k",

    absoluteAudioPath,
  ];

  return new Promise(
    (
      resolve,
      reject,
    ) => {
      const childProcess =
        spawn(
          "ffmpeg",
          args,
          {
            shell: false,
          },
        );

      let stderr = "";

      childProcess.stderr.on(
        "data",
        (
          data: Buffer,
        ) => {
          stderr +=
            data.toString();
        },
      );

      childProcess.on(
        "error",
        (
          error,
        ) => {
          reject(
            new Error(
              `Unable to start FFmpeg: ${error.message}`,
            ),
          );
        },
      );

      childProcess.on(
        "close",
        (
          exitCode,
        ) => {
          if (
            exitCode !== 0
          ) {
            reject(
              new Error(
                stderr.trim() ||
                  `FFmpeg exited with code ${exitCode}`,
              ),
            );

            return;
          }

          const relativeAudioPath =
            path.relative(
              process.cwd(),
              absoluteAudioPath,
            );

          resolve({
            audioPath:
              relativeAudioPath,
          });
        },
      );
    },
  );
}

export async function generateVerticalClip(
  input: GenerateVerticalClipInput,
): Promise<void> {
  const {
    videoPath,
    outputPath,
    start,
    end,
    reframeTrack,
    subtitlePath,
  } = input;

  if (start < 0) {
    throw new Error(
      "CLIP_START_INVALID",
    );
  }

  if (
    end <= start
  ) {
    throw new Error(
      "CLIP_END_INVALID",
    );
  }

  const duration =
    end - start;

  const absoluteVideoPath =
    path.resolve(
      process.cwd(),
      videoPath,
    );

  const absoluteOutputPath =
    path.resolve(
      process.cwd(),
      outputPath,
    );

  await mkdir(
    path.dirname(
      absoluteOutputPath,
    ),
    {
      recursive: true,
    },
  );

  const cropXExpression =
    buildCropXExpression(
      reframeTrack,
    );

  const escapedCropXExpression =
    escapeFfmpegExpression(
      cropXExpression,
    );

  /*
   * We intentionally keep the full
   * source height.
   *
   * No 1.35x zoom anymore.
   *
   * The vertical crop width is derived
   * from the source height.
   */
  const cropWidthExpression =
    escapeFfmpegExpression(
      "min(iw,ceil(ih*9/16/2)*2)",
    );

  console.log(
    [
      "Dynamic reframe:",
      `strategy=${reframeTrack.strategy}`,
      `rate=${(
        reframeTrack.detectionRate *
        100
      ).toFixed(1)}%`,
      `points=${reframeTrack.points.length}`,
    ].join(" "),
  );

  const videoFilters = [
    /*
     * Critical:
     *
     * t must start at 0 for our ReframeTrack
     * because its timestamps are relative
     * to the beginning of the Short.
     */
    "setpts=PTS-STARTPTS",

    /*
     * x is evaluated for every frame.
     */
    (
      `crop=` +
      `w=${cropWidthExpression}:` +
      `h=ih:` +
      `x=${escapedCropXExpression}:` +
      `y=0`
    ),

    /*
     * Final Shorts resolution.
     */
    "scale=1080:1920",

    "setsar=1",
  ];

  if (
    subtitlePath
  ) {
    const absoluteSubtitlePath =
      path.resolve(
        process.cwd(),
        subtitlePath,
      );

    const escapedSubtitlePath =
      escapeFfmpegFilterPath(
        absoluteSubtitlePath,
      );

    videoFilters.push(
      `ass=filename='${escapedSubtitlePath}'`,
    );
  }

  const args = [
    "-y",

    "-ss",
    start.toFixed(3),

    "-i",
    absoluteVideoPath,

    "-t",
    duration.toFixed(3),

    "-map",
    "0:v:0",

    "-map",
    "0:a:0?",

    "-vf",
    videoFilters.join(","),

    "-c:v",
    "libx264",

    "-preset",
    "veryfast",

    "-crf",
    "21",

    "-pix_fmt",
    "yuv420p",

    "-c:a",
    "aac",

    "-b:a",
    "128k",

    "-movflags",
    "+faststart",

    "-avoid_negative_ts",
    "make_zero",

    absoluteOutputPath,
  ];

  await new Promise<void>(
    (
      resolve,
      reject,
    ) => {
      const childProcess =
        spawn(
          "ffmpeg",
          args,
          {
            shell: false,
          },
        );

      let stderr = "";

      childProcess.stderr.on(
        "data",
        (
          data: Buffer,
        ) => {
          stderr +=
            data.toString();
        },
      );

      childProcess.on(
        "error",
        (
          error,
        ) => {
          reject(
            new Error(
              `Unable to start FFmpeg: ${error.message}`,
            ),
          );
        },
      );

      childProcess.on(
        "close",
        (
          exitCode,
        ) => {
          if (
            exitCode !== 0
          ) {
            reject(
              new Error(
                stderr.trim() ||
                  `FFmpeg exited with code ${exitCode}`,
              ),
            );

            return;
          }

          resolve();
        },
      );
    },
  );
}