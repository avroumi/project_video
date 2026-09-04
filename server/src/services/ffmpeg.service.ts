import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";

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

  const [numeratorText, denominatorText] =
    value.split("/");

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

  return numerator / denominator;
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
    (resolve, reject) => {
      const childProcess = spawn(
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
        (data: Buffer) => {
          stdout += data.toString();
        },
      );

      childProcess.stderr.on(
        "data",
        (data: Buffer) => {
          stderr += data.toString();
        },
      );

      childProcess.on(
        "error",
        (error) => {
          reject(
            new Error(
              `Unable to start ffprobe: ${error.message}`,
            ),
          );
        },
      );

      childProcess.on(
        "close",
        (exitCode) => {
          if (exitCode !== 0) {
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
              JSON.parse(stdout);

            if (
              !isFfprobeOutput(parsed)
            ) {
              throw new Error(
                "Invalid ffprobe response.",
              );
            }

            const videoStream =
              parsed.streams?.find(
                (stream) =>
                  stream.codec_type ===
                  "video",
              );

            const audioStream =
              parsed.streams?.find(
                (stream) =>
                  stream.codec_type ===
                  "audio",
              );

            if (!videoStream) {
              throw new Error(
                "No video stream found.",
              );
            }

            const durationSeconds =
              Number(
                parsed.format?.duration,
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
                    parsed.format.size,
                  )
                : undefined;

            const metadata: VideoMetadata =
              {
                durationSeconds,

                width:
                  videoStream.width ?? 0,

                height:
                  videoStream.height ?? 0,

                fps: parseFrameRate(
                  videoStream.avg_frame_rate,
                ),

                formatName:
                  parsed.format
                    ?.format_name,

                videoCodec:
                  videoStream.codec_name,

                audioCodec:
                  audioStream?.codec_name,
              };

            if (
              fileSize !== undefined &&
              Number.isFinite(fileSize)
            ) {
              metadata.fileSizeBytes =
                fileSize;
            }

            resolve(metadata);
          } catch (error) {
            const message =
              error instanceof Error
                ? error.message
                : "Unable to parse ffprobe output.";

            reject(
              new Error(message),
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
    (resolve, reject) => {
      const childProcess = spawn(
        "ffmpeg",
        args,
        {
          shell: false,
        },
      );

      let stderr = "";

      childProcess.stderr.on(
        "data",
        (data: Buffer) => {
          stderr += data.toString();
        },
      );

      childProcess.on(
        "error",
        (error) => {
          reject(
            new Error(
              `Unable to start FFmpeg: ${error.message}`,
            ),
          );
        },
      );

      childProcess.on(
        "close",
        (exitCode) => {
          if (exitCode !== 0) {
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