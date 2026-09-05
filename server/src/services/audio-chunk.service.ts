import { spawn } from "node:child_process";

import {
  mkdir,
  readdir,
  rm,
} from "node:fs/promises";

import path from "node:path";

import type {
  AudioChunk,
  AudioChunkingResult,
} from "../types/audio-chunk.js";

async function probeAudioDuration(
  audioPath: string,
): Promise<number> {
  const absoluteAudioPath =
    path.resolve(
      process.cwd(),
      audioPath,
    );

  const args = [
    "-v",
    "error",

    "-show_entries",
    "format=duration",

    "-of",
    "default=noprint_wrappers=1:nokey=1",

    absoluteAudioPath,
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

          const duration =
            Number(
              stdout.trim(),
            );

          if (
            !Number.isFinite(
              duration,
            ) ||
            duration <= 0
          ) {
            reject(
              new Error(
                "AUDIO_DURATION_INVALID",
              ),
            );

            return;
          }

          resolve(
            duration,
          );
        },
      );
    },
  );
}

async function runFfmpeg(
  args: string[],
): Promise<void> {
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

export async function splitAudioIntoChunks(
  audioPath: string,
  jobId: string,
  chunkDurationSeconds: number,
): Promise<AudioChunkingResult> {
  if (
    !Number.isFinite(
      chunkDurationSeconds,
    ) ||
    chunkDurationSeconds <= 0
  ) {
    throw new Error(
      "TRANSCRIPTION_CHUNK_DURATION_INVALID",
    );
  }

  const totalDurationSeconds =
    await probeAudioDuration(
      audioPath,
    );

  /*
   * Small audio:
   * don't create another file unnecessarily.
   */
  if (
    totalDurationSeconds <=
    chunkDurationSeconds
  ) {
    return {
      chunks: [
        {
          index: 0,

          offsetSeconds: 0,

          audioPath,
        },
      ],

      totalDurationSeconds,

      chunkDurationSeconds,
    };
  }

  const absoluteAudioPath =
    path.resolve(
      process.cwd(),
      audioPath,
    );

  const outputDirectory =
    path.resolve(
      process.cwd(),
      "storage",
      "audio",
      jobId,
      "chunks",
    );

  /*
   * Remove chunks from a previous
   * processing attempt.
   */
  await rm(
    outputDirectory,
    {
      recursive: true,
      force: true,
    },
  );

  await mkdir(
    outputDirectory,
    {
      recursive: true,
    },
  );

  const outputPattern =
    path.join(
      outputDirectory,
      "chunk-%03d.mp3",
    );

  const args = [
    "-y",

    "-i",
    absoluteAudioPath,

    "-map",
    "0:a:0",

    "-f",
    "segment",

    "-segment_time",
    chunkDurationSeconds.toString(),

    "-reset_timestamps",
    "1",

    /*
     * No new audio compression.
     *
     * Our source is already MP3 64 kbps.
     */
    "-c",
    "copy",

    outputPattern,
  ];

  await runFfmpeg(
    args,
  );

  const files =
    (
      await readdir(
        outputDirectory,
      )
    )
      .filter(
        (
          fileName,
        ) =>
          fileName.startsWith(
            "chunk-",
          ) &&
          fileName.endsWith(
            ".mp3",
          ),
      )
      .sort();

  if (
    files.length === 0
  ) {
    throw new Error(
      "NO_AUDIO_CHUNKS_CREATED",
    );
  }

  const chunks:
    AudioChunk[] =
    files.map(
      (
        fileName,
        index,
      ) => {
        const absoluteChunkPath =
          path.join(
            outputDirectory,
            fileName,
          );

        return {
          index,

          /*
           * Example:
           *
           * chunk 0 → 0
           * chunk 1 → 900
           * chunk 2 → 1800
           */
          offsetSeconds:
            index *
            chunkDurationSeconds,

          audioPath:
            path.relative(
              process.cwd(),
              absoluteChunkPath,
            ),
        };
      },
    );

  return {
    chunks,

    totalDurationSeconds,

    chunkDurationSeconds,
  };
}