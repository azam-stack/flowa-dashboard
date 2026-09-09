import clsx from "clsx";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { StatusPill } from "./StatusPill";
import type { AlertLevel } from "@/lib/alerts";

interface MetricTileProps {
  label: string;
  value: string;
  level?: AlertLevel;
  levelLabel?: string;
  delta?: { value: string; direction: "op" | "ned" | "neutral"; godt?: boolean };
  meaning: string;
  className?: string;
}

/**
 * The decision-first stat block: a sharp number, a verdict, a delta, and a
 * one-line sentence of what it means — never a bare number.
 */
export function MetricTile({ label, value, level, levelLabel, delta, meaning, className }: MetricTileProps) {
  return (
    <div className={clsx("rounded-2xl border border-ink-100 bg-white p-5", className)}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-[13px] font-medium text-ink-500">{label}</span>
        {level && <StatusPill level={level} label={levelLabel} />}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="num font-display text-3xl font-semibold leading-none text-ink-900">{value}</span>
        {delta && (
          <span
            className={clsx(
              "num inline-flex items-center gap-0.5 text-sm font-medium",
              delta.godt === undefined ? "text-ink-400" : delta.godt ? "text-status-good" : "text-status-crit",
            )}
          >
            {delta.direction === "op" ? <TrendingUp size={14} /> : delta.direction === "ned" ? <TrendingDown size={14} /> : <Minus size={14} />}
            {delta.value}
          </span>
        )}
      </div>
      <p className="mt-2 text-sm leading-snug text-ink-600">{meaning}</p>
    </div>
  );
}
