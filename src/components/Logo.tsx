/** The real Flowa wordmark (public/flowa-logo.png, mirrored in assets/) — used as-is. */
export function Logo({ className }: { className?: string }) {
  return <img src="/flowa-logo.png" alt="Flowa" className={`h-7 w-auto rounded-md ${className ?? ""}`} />;
}
