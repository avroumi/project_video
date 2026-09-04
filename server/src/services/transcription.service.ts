import fs from "node:fs";
import {
  mkdir,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import OpenAI from "openai";

import type {
  Transcript,
  TranscriptSegment,
  TranscriptWord,
} from "../types/transcript.js";

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

export async function transcribeAudio(
  audioPath: string,
  jobId: string,
): Promise<TranscriptionResult> {
  const absoluteAudioPath =
    path.resolve(
      process.cwd(),
      audioPath,
    );

  const openai =
    getOpenAIClient();

  const response =
    await openai.audio.transcriptions.create({
      file: fs.createReadStream(
        absoluteAudioPath,
      ),

      model: "whisper-1",

      response_format:
        "verbose_json",

      timestamp_granularities: [
        "segment",
        "word",
      ],

      temperature: 0,
    });

  const segments: TranscriptSegment[] =
    (response.segments ?? []).map(
      (segment) => ({
        id: segment.id,
        start: segment.start,
        end: segment.end,
        text: segment.text.trim(),
      }),
    );

  const words: TranscriptWord[] =
    (response.words ?? []).map(
      (word) => ({
        word: word.word,
        start: word.start,
        end: word.end,
      }),
    );

  const transcript: Transcript = {
    text: response.text,
    language: response.language,
    durationSeconds:
      response.duration,

    segments,
    words,
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

  const relativeTranscriptPath =
    path.relative(
      process.cwd(),
      absoluteTranscriptPath,
    );

  return {
    transcript,
    transcriptPath:
      relativeTranscriptPath,
  };
}