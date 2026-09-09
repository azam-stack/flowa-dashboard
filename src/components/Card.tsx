import clsx from "clsx";

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx("rounded-2xl border border-ink-100 bg-white p-5 shadow-card", className)} {...rest}>
      {children}
    </div>
  );
}

export function SectionTitle({ children, action, className }: { children: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={clsx("mb-3 flex items-center justify-between", className)}>
      <h2 className="font-display text-lg font-semibold text-ink-900">{children}</h2>
      {action}
    </div>
  );
}
