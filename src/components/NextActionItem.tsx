import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, X, ArrowRight, Info } from "lucide-react";
import type { NextAction } from "@/lib/next-actions";
import { useData } from "@/hooks/useData";
import { completeTask } from "@/lib/taskActions";
import type { Meeting, FlowaTask } from "@/schema";

const REJECTION_REASONS: Array<{ key: string; label: string }> = [
  { key: "forkert_icp", label: "Forkert ICP" },
  { key: "ikke_beslutningstager", label: "Ikke beslutningstager" },
  { key: "intet_reelt_behov", label: "Intet reelt behov" },
  { key: "dårligt_timet", label: "Dårligt timet" },
  { key: "kunde_dukkede_ikke_op", label: "Kunden dukkede ikke op" },
];

export function NextActionItem({ index, action }: { index: number; action: NextAction }) {
  const { dataset, update, create } = useData();
  const navigate = useNavigate();
  const [rejecting, setRejecting] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!dataset) return null;

  async function approveMeeting() {
    setBusy(true);
    await update<Meeting>("meetings", action.inline!.entityId, { godkendelse: "godkendt", godkendelseOpdateretDato: new Date().toISOString().slice(0, 10), faktureres: true });
    setBusy(false);
  }
  async function rejectMeeting(reason: string) {
    setBusy(true);
    await update<Meeting>("meetings", action.inline!.entityId, { godkendelse: "afvist", afvisningsårsag: reason as Meeting["afvisningsårsag"], godkendelseOpdateretDato: new Date().toISOString().slice(0, 10), faktureres: false });
    setBusy(false);
    setRejecting(false);
  }
  async function markTaskDone() {
    setBusy(true);
    const task = dataset!.tasks.find((t) => t.id === action.inline!.entityId);
    if (task) await completeTask(task as FlowaTask, update, create);
    setBusy(false);
  }

  return (
    <li className="group relative flex items-start gap-3 rounded-xl border border-ink-100 bg-white p-3.5">
      <span className="font-display mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink-800 text-xs font-semibold text-white">
        {index}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-snug text-ink-900">{action.titel}</p>
        <p className="mt-0.5 text-xs text-ink-500">{action.begrundelse}</p>

        {rejecting && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {REJECTION_REASONS.map((r) => (
              <button
                key={r.key}
                disabled={busy}
                onClick={() => rejectMeeting(r.key)}
                className="rounded-full border border-ink-200 px-2 py-0.5 text-xs text-ink-600 hover:border-status-crit hover:text-status-crit"
              >
                {r.label}
              </button>
            ))}
            <button onClick={() => setRejecting(false)} className="text-xs text-ink-400 underline">
              Fortryd
            </button>
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <span className="relative">
          <Info size={13} className="cursor-default text-ink-300" />
          <span className="pointer-events-none absolute right-0 top-5 z-10 hidden w-48 rounded-lg bg-ink-900 p-2 text-[11px] leading-snug text-white group-hover:block">
            Konsekvens {action.score.konsekvens}/5 · Hastende {action.score.hastende}/5 · Indsats {action.score.indsats}/5 → score {action.score.total}
          </span>
        </span>

        {action.inline?.type === "godkend_møde" && !rejecting && (
          <>
            <button disabled={busy} onClick={approveMeeting} title="Godkend" className="rounded-lg bg-status-good-bg p-1.5 text-status-good hover:opacity-80">
              <Check size={15} />
            </button>
            <button disabled={busy} onClick={() => setRejecting(true)} title="Afvis" className="rounded-lg bg-status-crit-bg p-1.5 text-status-crit hover:opacity-80">
              <X size={15} />
            </button>
          </>
        )}
        {action.inline?.type === "udfør_task" && (
          <button disabled={busy} onClick={markTaskDone} title="Markér udført" className="rounded-lg bg-status-good-bg p-1.5 text-status-good hover:opacity-80">
            <Check size={15} />
          </button>
        )}
        <button onClick={() => navigate(action.route)} title="Gå til" className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-50 hover:text-ink-700">
          <ArrowRight size={15} />
        </button>
      </div>
    </li>
  );
}
