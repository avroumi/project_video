import {
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";

import path from "node:path";

import OpenAI from "openai";

import type {
  ClipAnalysis,
  ClipCandidate,
} from "../types/clip-candidate.js";

import type {
  Transcript,
  TranscriptSegment,
} from "../types/transcript.js";

interface AnalyzeClipsResult {
  clips: ClipCandidate[];
  analysisPath: string;
}

function getOpenAIClient(): OpenAI {
  const apiKey =
    process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY_MISSING",
    );
  }

  return new OpenAI({
    apiKey,
  });
}

function isObject(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null
  );
}

function isTranscriptSegment(
  value: unknown,
): value is TranscriptSegment {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.id === "number" &&
    typeof value.start === "number" &&
    typeof value.end === "number" &&
    typeof value.text === "string"
  );
}

function isTranscript(
  value: unknown,
): value is Transcript {
  if (!isObject(value)) {
    return false;
  }

  if (
    typeof value.text !== "string" ||
    typeof value.language !== "string" ||
    typeof value.durationSeconds !== "number"
  ) {
    return false;
  }

  if (!Array.isArray(value.segments)) {
    return false;
  }

  if (!Array.isArray(value.words)) {
    return false;
  }

  return value.segments.every(
    isTranscriptSegment,
  );
}

function isClipCandidate(
  value: unknown,
): value is ClipCandidate {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.start === "number" &&
    typeof value.end === "number" &&
    typeof value.title === "string" &&
    typeof value.hook === "string" &&
    typeof value.score === "number" &&
    typeof value.reason === "string"
  );
}

function isClipAnalysis(
  value: unknown,
): value is ClipAnalysis {
  if (!isObject(value)) {
    return false;
  }

  if (!Array.isArray(value.clips)) {
    return false;
  }

  return value.clips.every(
    isClipCandidate,
  );
}

function formatTimestamp(
  seconds: number,
): string {
  return seconds.toFixed(2);
}

function buildTranscriptForAnalysis(
  transcript: Transcript,
): string {
  return transcript.segments
    .map((segment) => {
      const start =
        formatTimestamp(
          segment.start,
        );

      const end =
        formatTimestamp(
          segment.end,
        );

      return (
        `[${start} - ${end}] ` +
        segment.text
      );
    })
    .join("\n");
}

function validateClipCandidate(
  clip: ClipCandidate,
  transcriptDuration: number,
): boolean {
  if (
    !Number.isFinite(clip.start) ||
    !Number.isFinite(clip.end) ||
    !Number.isFinite(clip.score)
  ) {
    return false;
  }

  if (clip.start < 0) {
    return false;
  }

  if (clip.end <= clip.start) {
    return false;
  }

  if (
    clip.end >
    transcriptDuration + 1
  ) {
    return false;
  }

  if (
    clip.score < 0 ||
    clip.score > 10
  ) {
    return false;
  }

  return true;
}

export async function analyzeTranscriptForClips(
  transcriptPath: string,
  jobId: string,
): Promise<AnalyzeClipsResult> {
  const absoluteTranscriptPath =
    path.resolve(
      process.cwd(),
      transcriptPath,
    );

  const transcriptFile =
    await readFile(
      absoluteTranscriptPath,
      "utf8",
    );

  let parsedTranscript: unknown;

  try {
    parsedTranscript =
      JSON.parse(
        transcriptFile,
      );
  } catch {
    throw new Error(
      "TRANSCRIPT_JSON_INVALID",
    );
  }

  if (
    !isTranscript(
      parsedTranscript,
    )
  ) {
    throw new Error(
      "TRANSCRIPT_STRUCTURE_INVALID",
    );
  }

  const transcript =
    parsedTranscript;

  const formattedTranscript =
    buildTranscriptForAnalysis(
      transcript,
    );

  const model =
    process.env
      .CLIP_ANALYSIS_MODEL ??
    "gpt-5.6-luna";

  const openai =
    getOpenAIClient();

  const response =
    await openai.responses.create({
      model,

      instructions: `
You are an expert short-form video editor.

Your job is to identify the strongest self-contained moments
from a long-form video transcript that could work as YouTube Shorts.

Do not simply summarize the transcript.

Evaluate potential clips based on:
- strength of the opening hook
- standalone comprehension
- emotional impact
- surprise
- useful teaching
- strong opinion or memorable statement
- storytelling
- shareability
- clarity
- retention potential

Rules:
- Return between 1 and 5 clip candidates.
- Prefer 3 to 5 when the transcript contains enough strong material.
- Do not create weak clips just to reach a quota.
- A candidate should normally be around 20 to 60 seconds.
- Shorter clips are allowed when the idea is exceptionally strong.
- Avoid clips longer than 90 seconds.
- Each clip must make sense without watching the whole video.
- Avoid starting in the middle of a sentence.
- Avoid ending before the idea is complete.
- Use timestamps that exist in the supplied transcript.
- Prefer starting at the start timestamp of a transcript segment.
- Prefer ending at the end timestamp of a transcript segment.
- Never invent content that is not present in the transcript.
- score must be from 0 to 10.
`.trim(),

      input: `
Video language:
${transcript.language}

Video duration:
${transcript.durationSeconds.toFixed(2)} seconds

Transcript with timestamps:

${formattedTranscript}
`.trim(),

      text: {
        format: {
          type: "json_schema",

          name:
            "clip_candidate_analysis",

          description:
            "The strongest candidate passages for short-form videos.",

          strict: true,

          schema: {
            type: "object",

            properties: {
              clips: {
                type: "array",

                items: {
                  type: "object",

                  properties: {
                    start: {
                      type: "number",
                    },

                    end: {
                      type: "number",
                    },

                    title: {
                      type: "string",
                    },

                    hook: {
                      type: "string",
                    },

                    score: {
                      type: "number",
                    },

                    reason: {
                      type: "string",
                    },
                  },

                  required: [
                    "start",
                    "end",
                    "title",
                    "hook",
                    "score",
                    "reason",
                  ],

                  additionalProperties:
                    false,
                },
              },
            },

            required: [
              "clips",
            ],

            additionalProperties:
              false,
          },
        },
      },
    });

  if (!response.output_text) {
    throw new Error(
      "CLIP_ANALYSIS_EMPTY_RESPONSE",
    );
  }

  let parsedAnalysis: unknown;

  try {
    parsedAnalysis =
      JSON.parse(
        response.output_text,
      );
  } catch {
    throw new Error(
      "CLIP_ANALYSIS_INVALID_JSON",
    );
  }

  if (
    !isClipAnalysis(
      parsedAnalysis,
    )
  ) {
    throw new Error(
      "CLIP_ANALYSIS_INVALID_STRUCTURE",
    );
  }

  const validClips =
    parsedAnalysis.clips
      .filter((clip) =>
        validateClipCandidate(
          clip,
          transcript.durationSeconds,
        ),
      )
      .sort(
        (a, b) =>
          b.score - a.score,
      )
      .slice(0, 5);

  if (
    validClips.length === 0
  ) {
    throw new Error(
      "NO_VALID_CLIP_CANDIDATES",
    );
  }

  const analysis: ClipAnalysis = {
    clips: validClips,
  };

  const outputDirectory =
    path.resolve(
      process.cwd(),
      "storage",
      "analysis",
      jobId,
    );

  await mkdir(
    outputDirectory,
    {
      recursive: true,
    },
  );

  const absoluteAnalysisPath =
    path.join(
      outputDirectory,
      "clip-candidates.json",
    );

  await writeFile(
    absoluteAnalysisPath,
    JSON.stringify(
      analysis,
      null,
      2,
    ),
    "utf8",
  );

  const relativeAnalysisPath =
    path.relative(
      process.cwd(),
      absoluteAnalysisPath,
    );

  return {
    clips: validClips,

    analysisPath:
      relativeAnalysisPath,
  };
}