import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clock3, History } from "lucide-react";
import type { AlertWithState } from "@/lib/alerts";
import { isLongstanding } from "@/lib/alerts";
import { useData } from "@/hooks/useData";
import clsx from "clsx";

const LEVEL_BORDER: Record<string, string> = {
  kritisk: "border-l-status-crit",
  advarsel: "border-l-status-warn",
  sund: "border-l-status-good",
};

export function AlertLine({ alert }: { alert: AlertWithState }) {
  const { dataset, snoozeAlert } = useData();
  const navigate = useNavigate();
  const [snoozing, setSnoozing] = useState(false);
  const [reason, setReason] = useState("");
  if (!dataset) return null;
  const longstanding = isLongstanding(alert, dataset.settings);

  return (
    <div className={clsx("rounded-xl border border-ink-100 border-l-4 bg-white p-4", LEVEL_BORDER[alert.niveau])}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium leading-snug text-ink-900">{alert.titel}</p>
            {longstanding && (
              <span title="Har været rød i over en uge uden handling" className="inline-flex shrink-0 items-center gap-1 rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-medium text-ink-500">
                <History size={11} /> langvarig
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-ink-600">{alert.konsekvens}</p>
          <p className="mt-1.5 text-sm font-medium text-brand-800">→ {alert.handling}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <button
            onClick={() => navigate(alert.handlingRoute)}
            className="rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-semibold text-ink-900 transition hover:bg-brand-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700"
          >
            Gå til
          </button>
          <button
            onClick={() => setSnoozing((s) => !s)}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-ink-400 hover:bg-ink-50 hover:text-ink-600"
          >
            <Clock3 size={12} /> Udsæt
          </button>
        </div>
      </div>
      {snoozing && (
        <form
          className="mt-3 flex items-center gap-2 border-t border-ink-100 pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!reason.trim()) return;
            snoozeAlert(alert.id, 3, reason.trim());
            setSnoozing(false);
            setReason("");
          }}
        >
          <input
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Begrundelse for at udsætte 3 dage…"
            className="min-w-0 flex-1 rounded-lg border border-ink-200 px-2.5 py-1.5 text-sm focus-visible:outline-brand-600"
          />
          <button type="submit" className="rounded-lg bg-ink-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-ink-900">
            Udsæt
          </button>
          <button type="button" onClick={() => setSnoozing(false)} className="text-sm text-ink-400 hover:text-ink-600">
            Annullér
          </button>
        </form>
      )}
    </div>
  );
}
