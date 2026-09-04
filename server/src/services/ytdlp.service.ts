import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";

interface DownloadVideoResult {
  videoPath: string;
}

export async function downloadYouTubeVideo(
  sourceUrl: string,
  jobId: string,
): Promise<DownloadVideoResult> {
  const outputDirectory = path.resolve(
    process.cwd(),
    "storage",
    "videos",
    jobId,
  );

  await mkdir(outputDirectory, {
    recursive: true,
  });

  const outputTemplate = path.join(
    outputDirectory,
    "%(id)s.%(ext)s",
  );

  const args = [
    "--no-playlist",

    "--js-runtimes",
    "node",

    "--format",
    "b[ext=mp4]/b",

    "--output",
    outputTemplate,

    "--no-progress",

    "--print",
    "after_move:__FILEPATH__%(filepath)s",

    sourceUrl,
  ];

  return new Promise((resolve, reject) => {
    const childProcess = spawn(
      "yt-dlp",
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

    childProcess.on("error", (error) => {
      reject(
        new Error(
          `Unable to start yt-dlp: ${error.message}`,
        ),
      );
    });

    childProcess.on("close", (exitCode) => {
      if (exitCode !== 0) {
        reject(
          new Error(
            stderr.trim() ||
              `yt-dlp exited with code ${exitCode}`,
          ),
        );

        return;
      }

      const outputLines = stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      const filepathLine = outputLines.find(
        (line) =>
          line.startsWith("__FILEPATH__"),
      );

      if (!filepathLine) {
        reject(
          new Error(
            "yt-dlp completed but no video path was returned.",
          ),
        );

        return;
      }

      const absoluteVideoPath =
        filepathLine.replace(
          "__FILEPATH__",
          "",
        );

      const relativeVideoPath =
        path.relative(
          process.cwd(),
          absoluteVideoPath,
        );

      resolve({
        videoPath: relativeVideoPath,
      });
    });
  });
}