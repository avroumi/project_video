import fs from "node:fs";

import {
  mkdir,
  writeFile,
} from "node:fs/promises";

import path from "node:path";

import OpenAI from "openai";

import type { AudioChunk } from "../types/audio-chunk.js";

import type {
  Transcript,
  TranscriptSegment,
  TranscriptWord,
} from "../types/transcript.js";

import { splitAudioIntoChunks } from "./audio-chunk.service.js";

interface TranscriptionResult {
  transcript: Transcript;

  transcriptPath: string;
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

function getChunkDurationSeconds(): number {
  const rawValue =
    process.env
      .TRANSCRIPTION_CHUNK_SECONDS ??
    "900";

  const parsedValue =
    Number(
      rawValue,
    );

  if (
    !Number.isFinite(
      parsedValue,
    ) ||
    parsedValue <= 0
  ) {
    throw new Error(
      "TRANSCRIPTION_CHUNK_SECONDS_INVALID",
    );
  }

  return parsedValue;
}

async function transcribeChunk(
  openai: OpenAI,
  chunk: AudioChunk,
): Promise<Transcript> {
  const absoluteAudioPath =
    path.resolve(
      process.cwd(),
      chunk.audioPath,
    );

  const response =
    await openai.audio.transcriptions.create({
      file:
        fs.createReadStream(
          absoluteAudioPath,
        ),

      model:
        "whisper-1",

      response_format:
        "verbose_json",

      timestamp_granularities: [
        "segment",
        "word",
      ],

      temperature: 0,
    });

  const segments:
    TranscriptSegment[] =
    (
      response.segments ??
      []
    ).map(
      (
        segment,
        index,
      ) => ({
        id: index,

        start:
          segment.start,

        end:
          segment.end,

        text:
          segment.text.trim(),
      }),
    );

  const words:
    TranscriptWord[] =
    (
      response.words ??
      []
    ).map(
      (
        word,
      ) => ({
        word:
          word.word,

        start:
          word.start,

        end:
          word.end,
      }),
    );

  return {
    text:
      response.text,

    language:
      response.language,

    durationSeconds:
      response.duration,

    segments,

    words,
  };
}

function globalTimestamp(
  localTimestamp: number,
  offsetSeconds: number,
  totalDurationSeconds: number,
): number {
  return Math.min(
    totalDurationSeconds,

    Math.max(
      0,
      localTimestamp +
        offsetSeconds,
    ),
  );
}

function getDominantLanguage(
  languages: string[],
): string {
  if (
    languages.length === 0
  ) {
    return "unknown";
  }

  const counts =
    new Map<
      string,
      number
    >();

  for (
    const language
    of languages
  ) {
    counts.set(
      language,

      (
        counts.get(
          language,
        ) ??
        0
      ) + 1,
    );
  }

  let winner =
    languages[0] ??
    "unknown";

  let winnerCount =
    0;

  for (
    const [
      language,
      count,
    ]
    of counts
  ) {
    if (
      count >
      winnerCount
    ) {
      winner =
        language;

      winnerCount =
        count;
    }
  }

  return winner;
}

async function saveChunkTranscript(
  transcript: Transcript,
  jobId: string,
  chunkIndex: number,
): Promise<void> {
  const outputDirectory =
    path.resolve(
      process.cwd(),
      "storage",
      "transcripts",
      jobId,
      "chunks",
    );

  await mkdir(
    outputDirectory,
    {
      recursive: true,
    },
  );

  const fileName =
    `chunk-${String(
      chunkIndex,
    ).padStart(
      3,
      "0",
    )}.json`;

  await writeFile(
    path.join(
      outputDirectory,
      fileName,
    ),

    JSON.stringify(
      transcript,
      null,
      2,
    ),

    "utf8",
  );
}

export async function transcribeAudio(
  audioPath: string,
  jobId: string,
): Promise<TranscriptionResult> {
  const chunkDurationSeconds =
    getChunkDurationSeconds();

  const chunkingResult =
    await splitAudioIntoChunks(
      audioPath,
      jobId,
      chunkDurationSeconds,
    );

  console.log(
    [
      "Transcription:",
      `${chunkingResult.chunks.length} chunk(s)`,
      `chunk=${chunkDurationSeconds}s`,
      `duration=${chunkingResult.totalDurationSeconds.toFixed(2)}s`,
    ].join(" "),
  );

  const openai =
    getOpenAIClient();

  const mergedSegments:
    TranscriptSegment[] = [];

  const mergedWords:
    TranscriptWord[] = [];

  const textParts:
    string[] = [];

  const languages:
    string[] = [];

  let nextSegmentId = 0;

  for (
    let index = 0;
    index <
    chunkingResult.chunks.length;
    index += 1
  ) {
    const chunk =
      chunkingResult
        .chunks[index];

    if (!chunk) {
      continue;
    }

    console.log(
      `Transcribing chunk ${index + 1}/${chunkingResult.chunks.length}`,
    );

    /*
     * Sequential on purpose.
     *
     * Easier on rate limits and easier
     * to debug than Promise.all().
     */
    const chunkTranscript =
      await transcribeChunk(
        openai,
        chunk,
      );

    await saveChunkTranscript(
      chunkTranscript,
      jobId,
      chunk.index,
    );

    const cleanedText =
      chunkTranscript
        .text
        .trim();

    if (cleanedText) {
      textParts.push(
        cleanedText,
      );
    }

    if (
      chunkTranscript
        .language
    ) {
      languages.push(
        chunkTranscript
          .language,
      );
    }

    for (
      const segment
      of chunkTranscript
        .segments
    ) {
      mergedSegments.push({
        id:
          nextSegmentId,

        start:
          globalTimestamp(
            segment.start,
            chunk.offsetSeconds,
            chunkingResult
              .totalDurationSeconds,
          ),

        end:
          globalTimestamp(
            segment.end,
            chunk.offsetSeconds,
            chunkingResult
              .totalDurationSeconds,
          ),

        text:
          segment.text,
      });

      nextSegmentId += 1;
    }

    for (
      const word
      of chunkTranscript.words
    ) {
      mergedWords.push({
        word:
          word.word,

        start:
          globalTimestamp(
            word.start,
            chunk.offsetSeconds,
            chunkingResult
              .totalDurationSeconds,
          ),

        end:
          globalTimestamp(
            word.end,
            chunk.offsetSeconds,
            chunkingResult
              .totalDurationSeconds,
          ),
      });
    }
  }

  const transcript:
    Transcript = {
    text:
      textParts.join(
        " ",
      ),

    language:
      getDominantLanguage(
        languages,
      ),

    durationSeconds:
      chunkingResult
        .totalDurationSeconds,

    segments:
      mergedSegments,

    words:
      mergedWords,
  };

  const outputDirectory =
    path.resolve(
      process.cwd(),
      "storage",
      "transcripts",
      jobId,
    );

  await mkdir(
    outputDirectory,
    {
      recursive: true,
    },
  );

  const absoluteTranscriptPath =
    path.join(
      outputDirectory,
      "transcript.json",
    );

  await writeFile(
    absoluteTranscriptPath,

    JSON.stringify(
      transcript,
      null,
      2,
    ),

    "utf8",
  );

  return {
    transcript,

    transcriptPath:
      path.relative(
        process.cwd(),
        absoluteTranscriptPath,
      ),
  };
}