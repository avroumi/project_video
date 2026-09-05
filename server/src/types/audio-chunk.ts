export interface AudioChunk {
  index: number;

  offsetSeconds: number;

  audioPath: string;
}

export interface AudioChunkingResult {
  chunks: AudioChunk[];

  totalDurationSeconds: number;

  chunkDurationSeconds: number;
}