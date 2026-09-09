/**
 * Flowa's signature shape: the hand-drawn, asymmetric O from the wordmark.
 * One organic path, reused everywhere a shape is needed — decoration,
 * mask, empty-state illustration, progress ring background — instead of
 * ten different ad-hoc shapes.
 */
const BLOB_PATH =
  "M45.8,-58.3C58.4,-49.7,67,-34.9,70.6,-19C74.2,-3.1,72.9,13.9,65.6,28.1C58.3,42.3,45,53.7,29.9,61.3C14.8,68.9,-2.1,72.7,-18.4,69.6C-34.7,66.5,-50.4,56.5,-60.6,42.4C-70.8,28.3,-75.5,10.1,-73.2,-6.9C-70.9,-23.9,-61.6,-39.7,-48.4,-48.5C-35.2,-57.3,-18.1,-59.1,-0.6,-58.2C16.9,-57.3,33.2,-66.9,45.8,-58.3Z";

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
