import { AlertTriangle, CheckCircle2, AlertOctagon, Clock } from "lucide-react";
import type { AlertLevel } from "@/lib/alerts";
import clsx from "clsx";

const CONFIG: Record<AlertLevel, { icon: typeof CheckCircle2; label: string; classes: string }> = {
  sund: { icon: CheckCircle2, label: "På track", classes: "bg-status-good-bg text-status-good" },
  advarsel: { icon: AlertTriangle, label: "Bør håndteres", classes: "bg-status-warn-bg text-status-warn" },
  kritisk: { icon: AlertOctagon, label: "Kræver handling", classes: "bg-status-crit-bg text-status-crit" },
};

interface StatusPillProps {
  level: AlertLevel;
  label?: string;
  className?: string;
}

/** Status is never color-alone: every pill carries an icon and a word. */
export function StatusPill({ level, label, className }: StatusPillProps) {
  const cfg = CONFIG[level];
  const Icon = cfg.icon;
  return (
    <span className={clsx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", cfg.classes, className)}>
      <Icon size={13} strokeWidth={2.5} />
      {label ?? cfg.label}
    </span>
  );
}

export function StaleBadge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-1.5 rounded-full bg-status-stale-bg px-2.5 py-1 text-xs font-medium text-status-stale", className)}>
      <Clock size={13} strokeWidth={2.5} />
      {children}
    </span>
  );
}
