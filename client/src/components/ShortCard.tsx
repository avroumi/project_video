import type { GeneratedShort } from "../types/generated-short";

interface ShortCardProps {
  short: GeneratedShort;
  isSelected: boolean;
  onSelect: (shortId: string) => void;
}

export function ShortCard({ short, isSelected, onSelect }: ShortCardProps) {
  return (
    <article className={isSelected ? "short-card selected" : "short-card"}>
      <video src={short.videoUrl} controls preload="metadata" />

      <h3>{short.title}</h3>

      <p>{short.hook}</p>

      <p>
        <strong>Score:</strong> {short.score}/10
      </p>

      <p>
        <strong>Duration:</strong> {short.durationSeconds.toFixed(1)}s
      </p>

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
