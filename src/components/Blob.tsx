/**
 * Flowa's signature shape: the hand-drawn, asymmetric O from the wordmark.
 * One organic path, reused everywhere a shape is needed — decoration,
 * mask, empty-state illustration, progress ring background — instead of
 * ten different ad-hoc shapes.
 */
// Traced to match the logo's hand-drawn O: irregular, asymmetric, with the
// distinctive inward pinch on the right side — not a generic rounded blob.
const BLOB_PATH =
  "M-5,-62C13,-64,34,-62,48,-48C58,-38,54,-28,46,-20C36,-10,22,-12,26,-2C30,8,50,4,50,22C50,38,36,36,26,46C16,56,4,64,-12,62C-30,60,-40,50,-46,36C-54,18,-58,4,-50,-14C-44,-28,-48,-38,-38,-48C-28,-58,-18,-60,-5,-62Z";

interface BlobProps {
  className?: string;
  id?: string;
}

export function Blob({ className }: BlobProps) {
  return (
    <svg viewBox="-100 -100 200 200" className={className} aria-hidden="true">
      <path d={BLOB_PATH} fill="currentColor" />
    </svg>
  );
}

/** Same shape used as a clip-path so photos/illustrations/numbers can sit inside it. */
export function BlobClip({ id, children, className }: { id: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className} style={{ clipPath: `url(#${id})`, WebkitClipPath: `url(#${id})` }}>
      <svg width="0" height="0" style={{ position: "absolute" }}>
        <clipPath id={id} clipPathUnits="objectBoundingBox" transform="translate(0.5 0.5) scale(0.0067) translate(-100 -100)">
          <path d={BLOB_PATH} />
        </clipPath>
      </svg>
      {children}
    </div>
  );
}
