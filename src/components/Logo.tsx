import { Blob } from "./Blob";

/** Wordmark rebuilt from the brief's description: soft serif lowercase, with
 * the hand-drawn O standing in for the letter itself. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-[3px] font-display text-2xl font-semibold lowercase tracking-tight text-ink-900 ${className ?? ""}`}>
      fl
      <span className="relative inline-block h-[0.72em] w-[0.72em] translate-y-[0.03em]">
        <Blob className="absolute inset-0 h-full w-full text-brand-500" />
      </span>
      wa
    </span>
  );
}
