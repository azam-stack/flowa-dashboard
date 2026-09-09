import { Blob } from "./Blob";

interface EmptyStateProps {
  title: string;
  body: string;
  action?: React.ReactNode;
}

/** Empty states say what to do now, never just "nothing here". */
export function EmptyState({ title, body, action }: EmptyStateProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-ink-100 bg-white px-8 py-14 text-center">
      <Blob className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 text-brand-50" />
      <Blob className="pointer-events-none absolute -bottom-20 -left-10 h-48 w-48 text-cream-200" />
      <div className="relative mx-auto max-w-md">
        <h3 className="font-display text-2xl font-semibold text-ink-900">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-ink-500">{body}</p>
        {action && <div className="mt-5">{action}</div>}
      </div>
    </div>
  );
}
