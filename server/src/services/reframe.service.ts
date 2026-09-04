import { spawn } from "node:child_process";
import path from "node:path";

import type {
  ReframeTrack,
  ReframeTrackPoint,
} from "../types/reframe-focus.js";

interface DetectReframeTrackInput {
  videoPath: string;

  start: number;
  end: number;

  interval?: number;
}

function isObject(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null
  );
}

function isReframeTrackPoint(
  value: unknown,
): value is ReframeTrackPoint {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.time === "number" &&
    typeof value.focusX === "number"
  );
}

function isReframeTrack(
  value: unknown,
): value is ReframeTrack {
  if (!isObject(value)) {
    return false;
  }

  if (
    value.strategy !==
      "dynamic_face" &&
    value.strategy !==
      "center"
  ) {
    return false;
  }

  if (
    typeof value.durationSeconds !==
      "number" ||
    typeof value.sampleCount !==
      "number" ||
    typeof value.detectionCount !==
      "number" ||
    typeof value.acceptedCount !==
      "number" ||
    typeof value.detectionRate !==
      "number"
  ) {
    return false;
  }

  if (
    !Array.isArray(
      value.points,
    )
  ) {
    return false;
  }

  return value.points.every(
    isReframeTrackPoint,
  );
}

export async function detectReframeTrack(
  input: DetectReframeTrackInput,
): Promise<ReframeTrack> {
  const {
    videoPath,
    start,
    end,
    interval = 0.75,
  } = input;

  const absoluteVideoPath =
    path.resolve(
      process.cwd(),
      videoPath,
    );

  const scriptPath =
    path.resolve(
      process.cwd(),
      "python",
      "detect_face_track.py",
    );

  const pythonBinary =
    process.env.PYTHON_BIN ??
    path.resolve(
      process.cwd(),
      ".venv",
      "bin",
      "python",
    );

  const args = [
    scriptPath,

    "--video",
    absoluteVideoPath,

    "--start",
    start.toString(),

    "--end",
    end.toString(),

    "--interval",
    interval.toString(),
  ];

  return new Promise(
    (
      resolve,
      reject,
    ) => {
      const childProcess =
        spawn(
          pythonBinary,
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
              `Unable to start reframe tracker: ${error.message}`,
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
                  `Reframe tracker exited with code ${exitCode}`,
              ),
            );

            return;
          }

          let parsed: unknown;

          try {
            parsed =
              JSON.parse(
                stdout.trim(),
              );
          } catch {
            reject(
              new Error(
                "REFRAME_TRACK_INVALID_JSON",
              ),
            );

            return;
          }

          if (
            !isReframeTrack(
              parsed,
            )
          ) {
            reject(
              new Error(
                "REFRAME_TRACK_INVALID_STRUCTURE",
              ),
            );

            return;
          }

          resolve(
            parsed,
          );
        },
      );
    },
  );
}