import {
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";

import path from "node:path";

import OpenAI from "openai";

import { getShortManifest } from "./short.service.js";

import type { Transcript } from "../types/transcript.js";

import type {
  YouTubeMetadata,
  YouTubeMetadataResult,
} from "../types/youtube-metadata.js";

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

function getModel(): string {
  return (
    process.env.CLIP_ANALYSIS_MODEL ??
    "gpt-5.6-luna"
  );
}

async function loadTranscript(
  jobId: string,
): Promise<Transcript> {
  const transcriptPath =
    path.resolve(
      process.cwd(),
      "storage",
      "transcripts",
      jobId,
      "transcript.json",
    );

  let fileContent: string;

  try {
    fileContent =
      await readFile(
        transcriptPath,
        "utf8",
      );
  } catch {
    throw new Error(
      "TRANSCRIPT_NOT_FOUND",
    );
  }

  return JSON.parse(
    fileContent,
  ) as Transcript;
}

function cleanHashtag(
  hashtag: string,
): string {
  const clean =
    hashtag.trim();

  if (!clean) {
    return "";
  }

  if (
    clean.startsWith("#")
  ) {
    return clean;
  }

  return `#${clean}`;
}

function validateMetadata(
  value: unknown,
): YouTubeMetadata {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    throw new Error(
      "INVALID_METADATA_RESPONSE",
    );
  }

  const object =
    value as Record<
      string,
      unknown
    >;

  if (
    typeof object.title !==
      "string" ||
    typeof object.description !==
      "string" ||
    !Array.isArray(
      object.hashtags,
    )
  ) {
    throw new Error(
      "INVALID_METADATA_RESPONSE",
    );
  }

  if (
    !object.hashtags.every(
      (hashtag) =>
        typeof hashtag ===
        "string",
    )
  ) {
    throw new Error(
      "INVALID_METADATA_RESPONSE",
    );
  }

  const hashtags =
    object.hashtags
      .map(cleanHashtag)
      .filter(Boolean)
      .slice(0, 8);

  return {
    title:
      object.title.trim(),

    description:
      object.description.trim(),

    hashtags,
  };
}

export async function generateYouTubeMetadata(
  jobId: string,
  shortId: string,
): Promise<YouTubeMetadataResult> {
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

  const transcript =
    await loadTranscript(
      jobId,
    );

  const clipSegments =
    transcript.segments.filter(
      (segment) =>
        segment.end >
          short.start &&
        segment.start <
          short.end,
    );

  const clipTranscript =
    clipSegments
      .map(
        (segment) =>
          segment.text,
      )
      .join(" ")
      .trim();

  if (!clipTranscript) {
    throw new Error(
      "SHORT_TRANSCRIPT_EMPTY",
    );
  }

  const openai =
    getOpenAIClient();

  const response =
    await openai.responses.create({
      model: getModel(),

      input: [
        {
          role: "system",

          content: `
You generate metadata for YouTube Shorts.

Your job is to create:
- one strong title
- one concise description
- relevant hashtags

Rules:
- Keep the same language as the spoken clip.
- Do not invent facts that are not present in the clip.
- The title should be compelling but not misleading.
- Avoid fake clickbait.
- Make the title suitable for YouTube Shorts.
- Keep the title under 90 characters.
- Keep the description concise.
- Return between 3 and 8 hashtags.
- Include #Shorts when appropriate.
          `.trim(),
        },

        {
          role: "user",

          content: `
Current candidate title:
${short.title}

Current hook:
${short.hook}

Clip transcript:
${clipTranscript}
          `.trim(),
        },
      ],

      text: {
        format: {
          type: "json_schema",

          name:
            "youtube_metadata",

          strict: true,

          schema: {
            type: "object",

            properties: {
              title: {
                type: "string",
              },

              description: {
                type: "string",
              },

              hashtags: {
                type: "array",

                items: {
                  type: "string",
                },

                minItems: 3,
                maxItems: 8,
              },
            },

            required: [
              "title",
              "description",
              "hashtags",
            ],

            additionalProperties:
              false,
          },
        },
      },
    });

  if (
    !response.output_text
  ) {
    throw new Error(
      "EMPTY_METADATA_RESPONSE",
    );
  }

  let parsed: unknown;

  try {
    parsed =
      JSON.parse(
        response.output_text,
      );
  } catch {
    throw new Error(
      "INVALID_METADATA_JSON",
    );
  }

  const metadata =
    validateMetadata(
      parsed,
    );

  const result:
    YouTubeMetadataResult = {
      shortId,
      metadata,
    };

  const outputDirectory =
    path.resolve(
      process.cwd(),
      "storage",
      "metadata",
      jobId,
    );

  await mkdir(
    outputDirectory,
    {
      recursive: true,
    },
  );

  const outputPath =
    path.join(
      outputDirectory,
      `${shortId}.json`,
    );

  await writeFile(
    outputPath,
    JSON.stringify(
      result,
      null,
      2,
    ),
    "utf8",
  );

  return result;
}