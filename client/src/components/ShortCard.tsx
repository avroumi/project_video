import type { GeneratedShort } from "../types/generated-short";

interface ShortCardProps {
  short: GeneratedShort;
  isSelected: boolean;
  onSelect: (shortId: string) => void;
}

export function ShortCard({ short, isSelected, onSelect }: ShortCardProps) {
  return (
    <article>
      <h3>{short.title}</h3>

      <video src={short.videoUrl} controls width="300" />

      <p>{short.hook}</p>

      <p>Score: {short.score}/10</p>

      <p>Duration: {short.durationSeconds.toFixed(1)}s</p>

      <p>{short.reason}</p>

      <button
        type="button"
        onClick={() => onSelect(short.id)}
        aria-pressed={isSelected}
      >
        {isSelected ? "Selected ✓" : "Select this Short"}
      </button>
    </article>
  );
}
