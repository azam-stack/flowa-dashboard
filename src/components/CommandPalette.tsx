import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ArrowRight } from "lucide-react";
import { useData } from "@/hooks/useData";

interface PaletteItem {
  id: string;
  label: string;
  hint: string;
  onSelect: () => void;
}

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const { dataset } = useData();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  const go = (path: string) => {
    navigate(path);
    onClose();
  };

  const items: PaletteItem[] = useMemo(() => {
    if (!dataset) return [];
    const nav: PaletteItem[] = [
      { id: "nav-today", label: "I dag", hint: "Modul", onSelect: () => go("/") },
      { id: "nav-sales", label: "Eget salg", hint: "Modul", onSelect: () => go("/eget-salg") },
      { id: "nav-delivery", label: "Levering", hint: "Modul", onSelect: () => go("/levering") },
      { id: "nav-quality", label: "Mødekvalitet", hint: "Modul", onSelect: () => go("/mødekvalitet") },
      { id: "nav-campaigns", label: "Kampagner", hint: "Modul", onSelect: () => go("/kampagner") },
      { id: "nav-infra", label: "Infrastruktur", hint: "Modul", onSelect: () => go("/infrastruktur") },
      { id: "nav-economy", label: "Økonomi", hint: "Modul", onSelect: () => go("/økonomi") },
      { id: "nav-capacity", label: "Kapacitet", hint: "Modul", onSelect: () => go("/kapacitet") },
      { id: "nav-tasks", label: "Tasks", hint: "Modul", onSelect: () => go("/tasks") },
      { id: "nav-review", label: "Ugentlig gennemgang", hint: "Modul", onSelect: () => go("/ugentlig-gennemgang") },
    ];
    const clients: PaletteItem[] = dataset.clients.map((c) => ({
      id: `client-${c.id}`, label: c.navn, hint: "Kunde", onSelect: () => go(`/levering/${c.id}`),
    }));
    const prospects: PaletteItem[] = dataset.prospects.map((p) => ({
      id: `prospect-${p.id}`, label: `${p.virksomhed} — ${p.kontaktperson}`, hint: "Prospect", onSelect: () => go(`/eget-salg?prospect=${p.id}`),
    }));
    const meetings: PaletteItem[] = dataset.meetings.map((m) => ({
      id: `meeting-${m.id}`, label: `${m.prospectNavn} (${m.virksomhed})`, hint: "Møde", onSelect: () => go(`/mødekvalitet?meeting=${m.id}`),
    }));
    const tasks: PaletteItem[] = dataset.tasks.filter((t) => t.status !== "afsluttet").map((t) => ({
      id: `task-${t.id}`, label: t.titel, hint: "Task", onSelect: () => go("/tasks"),
    }));
    return [...nav, ...clients, ...prospects, ...meetings, ...tasks];
  }, [dataset]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 8);
    return items.filter((i) => i.label.toLowerCase().includes(q) || i.hint.toLowerCase().includes(q)).slice(0, 20);
  }, [items, query]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink-900/40 pt-[12vh]" onClick={onClose}>
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-soft"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Kommandopalette"
      >
        <div className="flex items-center gap-2 border-b border-ink-100 px-4 py-3">
          <Search size={17} className="text-ink-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Søg kunder, prospects, møder, tasks — eller spring til et modul…"
            className="w-full text-sm text-ink-900 outline-none placeholder:text-ink-400"
          />
          <kbd className="rounded border border-ink-200 px-1.5 py-0.5 text-[10px] text-ink-400">ESC</kbd>
        </div>
        <ul className="max-h-80 overflow-y-auto py-2">
          {filtered.length === 0 && <li className="px-4 py-6 text-center text-sm text-ink-400">Ingen resultater</li>}
          {filtered.map((item) => (
            <li key={item.id}>
              <button
                onClick={item.onSelect}
                className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm text-ink-800 hover:bg-brand-50"
              >
                <span className="truncate">{item.label}</span>
                <span className="flex shrink-0 items-center gap-1 text-xs text-ink-400">
                  {item.hint}
                  <ArrowRight size={12} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
