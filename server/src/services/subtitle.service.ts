import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { ClipCandidate } from "../types/clip-candidate.js";
import type { Transcript, TranscriptWord } from "../types/transcript.js";

interface SubtitleCue {
  start: number;
  end: number;
  text: string;
}

interface CreateSubtitlesResult {
  subtitlePath: string;
  cueCount: number;
}

const MAX_WORDS_PER_CUE = 3;
const MAX_CUE_DURATION_SECONDS = 1.4;
const MAX_GAP_SECONDS = 0.45;

function joinWords(words: TranscriptWord[]): string {
  return words
    .map((word) => word.word.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+([,.!?;:])/g, "$1");
}

function createCue(
  words: TranscriptWord[],
  clip: ClipCandidate,
): SubtitleCue {
  const firstWord = words[0];
  const lastWord = words[words.length - 1];

  if (!firstWord || !lastWord) {
    throw new Error("SUBTITLE_CUE_EMPTY");
  }

  return {
    start:
      Math.max(firstWord.start, clip.start) -
      clip.start,

    end:
      Math.min(lastWord.end, clip.end) -
      clip.start,

    text: joinWords(words),
  };
}

function buildSubtitleCues(
  transcript: Transcript,
  clip: ClipCandidate,
): SubtitleCue[] {
  const clipWords = transcript.words.filter(
    (word) =>
      word.end > clip.start &&
      word.start < clip.end,
  );

  if (clipWords.length === 0) {
    throw new Error("NO_WORDS_FOR_CLIP");
  }

  const cues: SubtitleCue[] = [];

  let currentWords: TranscriptWord[] = [];

  for (const word of clipWords) {
    const firstWord = currentWords[0];
    const previousWord =
      currentWords[currentWords.length - 1];

    if (
      firstWord &&
      previousWord
    ) {
      const projectedDuration =
        word.end - firstWord.start;

      const gap =
        word.start - previousWord.end;

      const shouldStartNewCue =
        currentWords.length >=
          MAX_WORDS_PER_CUE ||
        projectedDuration >
          MAX_CUE_DURATION_SECONDS ||
        gap > MAX_GAP_SECONDS;

      if (shouldStartNewCue) {
        cues.push(
          createCue(
            currentWords,
            clip,
          ),
        );

        currentWords = [];
      }
    }

    currentWords.push(word);
  }

  if (currentWords.length > 0) {
    cues.push(
      createCue(
        currentWords,
        clip,
      ),
    );
  }

  return cues;
}

function formatAssTime(
  seconds: number,
): string {
  const safeSeconds =
    Math.max(0, seconds);

  const totalCentiseconds =
    Math.round(
      safeSeconds * 100,
    );

  const hours =
    Math.floor(
      totalCentiseconds /
        360000,
    );

  const minutes =
    Math.floor(
      (totalCentiseconds %
        360000) /
        6000,
    );

  const secs =
    Math.floor(
      (totalCentiseconds %
        6000) /
        100,
    );

  const centiseconds =
    totalCentiseconds % 100;

  return (
    `${hours}:` +
    `${String(minutes).padStart(2, "0")}:` +
    `${String(secs).padStart(2, "0")}.` +
    `${String(centiseconds).padStart(2, "0")}`
  );
}

function escapeAssText(
  value: string,
): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("{", "(")
    .replaceAll("}", ")")
    .replace(/\r?\n/g, "\\N");
}

function createAssFile(
  cues: SubtitleCue[],
): string {
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
ScaledBorderAndShadow: yes
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,DejaVu Sans,76,&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,5,2,2,60,60,300,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`;

  const events =
    cues.map((cue) => {
      const start =
        formatAssTime(cue.start);

      const end =
        formatAssTime(cue.end);

      const text =
        escapeAssText(cue.text);

      return `Dialogue: 0,${start},${end},Default,,0,0,0,,${text}`;
    });

  return [
    header,
    ...events,
    "",
  ].join("\n");
}

export async function createAssSubtitlesForClip(
  transcript: Transcript,
  clip: ClipCandidate,
  jobId: string,
  shortId: string,
): Promise<CreateSubtitlesResult> {
  const cues =
    buildSubtitleCues(
      transcript,
      clip,
    );

  const outputDirectory =
    path.resolve(
      process.cwd(),
      "storage",
      "shorts",
      jobId,
      "subtitles",
    );

  await mkdir(
    outputDirectory,
    {
      recursive: true,
    },
  );

  const absoluteSubtitlePath =
    path.join(
      outputDirectory,
      `${shortId}.ass`,
    );

  await writeFile(
    absoluteSubtitlePath,
    createAssFile(cues),
    "utf8",
  );

  return {
    subtitlePath:
      path.relative(
        process.cwd(),
        absoluteSubtitlePath,
      ),

    cueCount: cues.length,
  };
}