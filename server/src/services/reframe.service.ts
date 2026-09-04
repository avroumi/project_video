import { spawn } from "node:child_process";
import path from "node:path";

import type { ReframeFocus } from "../types/reframe-focus.js";

interface DetectReframeFocusInput {
  videoPath: string;
  start: number;
  end: number;
  samples?: number;
}

function isObject(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null
  );
}

function isReframeFocus(
  value: unknown,
): value is ReframeFocus {
  if (!isObject(value)) {
    return false;
  }

  return (
    (
      value.strategy === "face" ||
      value.strategy === "center"
    ) &&
    typeof value.focusX === "number" &&
    typeof value.focusY === "number" &&
    typeof value.faceWidthRatio === "number" &&
    typeof value.faceHeightRatio === "number" &&
    typeof value.sampleCount === "number" &&
    typeof value.detectionCount === "number"
  );
}

export async function detectReframeFocus(
  input: DetectReframeFocusInput,
): Promise<ReframeFocus> {
  const {
    videoPath,
    start,
    end,
    samples = 10,
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
      "detect_face_focus.py",
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

    "--samples",
    samples.toString(),
  ];

  return new Promise(
    (resolve, reject) => {
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
              `Unable to start face detector: ${error.message}`,
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
                  `Face detector exited with code ${exitCode}`,
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
                "FACE_DETECTION_INVALID_JSON",
              ),
            );

            return;
          }

          if (
            !isReframeFocus(
              parsed,
            )
          ) {
            reject(
              new Error(
                "FACE_DETECTION_INVALID_STRUCTURE",
              ),
            );

            return;
          }

          resolve(parsed);
        },
      );
    },
  );
}