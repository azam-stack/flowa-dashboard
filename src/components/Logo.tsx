/** The hand-drawn O, as an outline — same shape as `Blob`, traced from the
 * actual wordmark: irregular, asymmetric, with a pinch on the right side. */
const BLOB_PATH =
  "M-5,-62C13,-64,34,-62,48,-48C58,-38,54,-28,46,-20C36,-10,22,-12,26,-2C30,8,50,4,50,22C50,38,36,36,26,46C16,56,4,64,-12,62C-30,60,-40,50,-46,36C-54,18,-58,4,-50,-14C-44,-28,-48,-38,-38,-48C-28,-58,-18,-60,-5,-62Z";

/** Wordmark: heavy slab serif, lowercase, with the O drawn as an open
 * outline so the page background shows through it — matches the real mark. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-[1px] font-display text-2xl font-bold lowercase tracking-tight text-ink-900 ${className ?? ""}`}>
      fl
      <svg viewBox="-64 -68 128 136" className="relative -mx-[1px] inline-block h-[0.78em] w-[0.72em] translate-y-[0.05em]" aria-hidden="true">
        <path d={BLOB_PATH} fill="none" stroke="currentColor" strokeWidth="9" className="text-brand-500" />
      </svg>
      wa
    </span>
  );
}
