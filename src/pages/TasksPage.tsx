import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import { useData } from "@/hooks/useData";
import { PageHeader } from "@/components/PageHeader";
import { ExportButton } from "@/components/ExportButton";
import { completeTask } from "@/lib/taskActions";
import { todayISO, daysSince } from "@/lib/dates";
import type { FlowaTask } from "@/schema";
import clsx from "clsx";

type Tab = "i_dag" | "uge" | "forfaldne" | "alle";
const TABS: Array<{ key: Tab; label: string }> = [
  { key: "i_dag", label: "I dag" },
  { key: "uge", label: "Denne uge" },
  { key: "forfaldne", label: "Forfaldne" },
  { key: "alle", label: "Alle" },
];

const PRIO_COLOR: Record<FlowaTask["prioritet"], string> = {
  kritisk: "text-status-crit", høj: "text-status-warn", mellem: "text-ink-600", lav: "text-ink-400",
};

export default function TasksPage() {
  const { dataset, update, create } = useData();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("i_dag");
  const today = todayISO();
  if (!dataset) return null;

  const weekEnd = (() => {
    const d = new Date(today);
    const day = d.getDay();
    const diff = day === 0 ? 0 : 7 - day;
    d.setDate(d.getDate() + diff);
    return d.toISOString().slice(0, 10);
  })();

  const filtered = useMemo(() => {
    const open = dataset.tasks.filter((t) => t.status !== "afsluttet");
    switch (tab) {
      case "i_dag": return open.filter((t) => t.forfaldsdato === today);
      case "uge": return open.filter((t) => t.forfaldsdato >= today && t.forfaldsdato <= weekEnd);
      case "forfaldne": return open.filter((t) => t.forfaldsdato < today);
      case "alle": return open;
    }
  }, [dataset.tasks, tab, today, weekEnd]);

  const sorted = [...filtered].sort((a, b) => a.forfaldsdato.localeCompare(b.forfaldsdato));

  function relatedLabel(task: FlowaTask): { label: string; route: string } | null {
    if (!task.knyttetTil) return null;
    const { type, id } = task.knyttetTil;
    if (type === "klient") {
      const c = dataset!.clients.find((x) => x.id === id);
      return c ? { label: c.navn, route: `/levering/${c.id}` } : null;
    }
    if (type === "prospect") {
      const p = dataset!.prospects.find((x) => x.id === id);
      return p ? { label: p.virksomhed, route: `/eget-salg?prospect=${p.id}` } : null;
    }
    if (type === "møde") {
      const m = dataset!.meetings.find((x) => x.id === id);
      return m ? { label: `${m.prospectNavn} (${m.virksomhed})`, route: `/mødekvalitet?meeting=${m.id}` } : null;
    }
    if (type === "kampagne") {
      const c = dataset!.campaigns.find((x) => x.id === id);
      return c ? { label: c.navn, route: `/kampagner/${c.id}` } : null;
    }
    return null;
  }

  return (
    <div>
      <PageHeader title="Tasks" action={<ExportButton rows={dataset.tasks} filename="tasks" />} />

      <div className="mb-5 flex gap-1 rounded-xl bg-ink-50 p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={clsx("flex-1 rounded-lg py-1.5 text-sm font-medium", tab === t.key ? "bg-white text-ink-900 shadow-sm" : "text-ink-500")}
          >
            {t.label}
          </button>
        ))}
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-ink-400">Ingen tasks her. Godt gået.</p>
      ) : (
        <ul className="space-y-2">
          {sorted.map((t) => {
            const overdue = t.forfaldsdato < today;
            const related = relatedLabel(t);
            return (
              <li key={t.id} className="flex items-center gap-3 rounded-xl border border-ink-100 bg-white p-3">
                <button
                  onClick={() => completeTask(t, update, create)}
                  title="Markér udført"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-ink-200 text-transparent hover:border-status-good hover:bg-status-good-bg hover:text-status-good"
                >
                  <Check size={14} />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink-900">{t.titel}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-500">
                    <span className={overdue ? "font-medium text-status-crit" : ""}>
                      {overdue ? `Forfaldt for ${daysSince(t.forfaldsdato, today)} dage siden` : `Forfalder ${t.forfaldsdato}`}
                    </span>
                    {t.gentagelse && <span className="rounded-full bg-ink-100 px-1.5 py-0.5">{t.gentagelse}</span>}
                    {related && (
                      <button onClick={() => navigate(related.route)} className="text-brand-800 hover:underline">
                        {related.label}
                      </button>
                    )}
                  </p>
                </div>
                <span className={clsx("text-xs font-medium capitalize", PRIO_COLOR[t.prioritet])}>{t.prioritet}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
