import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import clsx from "clsx";
import {
  Sun, Target, LineChart, CalendarCheck2, Megaphone, Server, Wallet, Gauge, ListChecks, ClipboardList, Command, Plus,
} from "lucide-react";
import { Logo } from "./Logo";
import { useData } from "@/hooks/useData";
import { CommandPalette } from "./CommandPalette";
import { QuickCapture } from "./QuickCapture";
import { ShortcutsOverlay } from "./ShortcutsOverlay";

const NAV = [
  { to: "/", label: "I dag", icon: Sun, end: true },
  { to: "/eget-salg", label: "Eget salg", icon: Target },
  { to: "/levering", label: "Levering", icon: LineChart },
  { to: "/mødekvalitet", label: "Mødekvalitet", icon: CalendarCheck2 },
  { to: "/kampagner", label: "Kampagner", icon: Megaphone },
  { to: "/infrastruktur", label: "Infrastruktur", icon: Server },
  { to: "/økonomi", label: "Økonomi", icon: Wallet },
  { to: "/kapacitet", label: "Kapacitet", icon: Gauge },
  { to: "/tasks", label: "Tasks", icon: ListChecks },
  { to: "/ugentlig-gennemgang", label: "Ugentlig gennemgang", icon: ClipboardList },
];

export function Layout() {
  const { dataset, loading, error, alerts } = useData();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const typing = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      } else if (!typing && e.key === "?") {
        e.preventDefault();
        setShortcutsOpen((v) => !v);
      } else if (!typing && e.key.toLowerCase() === "n") {
        e.preventDefault();
        setCaptureOpen(true);
      } else if (e.key === "Escape") {
        setPaletteOpen(false);
        setCaptureOpen(false);
        setShortcutsOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const critCount = alerts.active.filter((a) => a.niveau === "kritisk").length;
  const warnCount = alerts.active.filter((a) => a.niveau === "advarsel").length;

  return (
    <div className="flex min-h-screen bg-cream-100">
      <aside className="no-print flex w-60 shrink-0 flex-col border-r border-ink-100 bg-white px-4 py-5">
        <div className="px-2">
          <Logo />
        </div>
        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                clsx(
                  "flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition",
                  isActive ? "bg-brand-50 text-brand-800" : "text-ink-500 hover:bg-ink-50 hover:text-ink-800",
                )
              }
            >
              <item.icon size={17} strokeWidth={2} />
              {item.label}
              {item.to === "/" && (critCount > 0 || warnCount > 0) && (
                <span className={clsx("ml-auto rounded-full px-1.5 py-0.5 text-[11px] font-semibold", critCount > 0 ? "bg-status-crit-bg text-status-crit" : "bg-status-warn-bg text-status-warn")}>
                  {critCount > 0 ? critCount : warnCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="flex flex-col gap-1.5 border-t border-ink-100 pt-3">
          <button
            onClick={() => setCaptureOpen(true)}
            className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-ink-500 hover:bg-ink-50 hover:text-ink-800"
          >
            <Plus size={17} /> Hurtig-tilføj
            <kbd className="ml-auto rounded border border-ink-200 px-1 text-[10px] text-ink-400">N</kbd>
          </button>
          <button
            onClick={() => setPaletteOpen(true)}
            className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-ink-500 hover:bg-ink-50 hover:text-ink-800"
          >
            <Command size={17} /> Søg / spring til
            <kbd className="ml-auto rounded border border-ink-200 px-1 text-[10px] text-ink-400">⌘K</kbd>
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-8 py-7">
        {loading && <div className="text-sm text-ink-400">Indlæser…</div>}
        {error && (
          <div className="rounded-xl border border-status-crit bg-status-crit-bg p-4 text-sm text-status-crit">
            <p className="font-semibold">Datafejl</p>
            <p className="mt-1">{error}</p>
          </div>
        )}
        {dataset && !error && <Outlet />}
      </main>

      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
      {captureOpen && <QuickCapture onClose={() => setCaptureOpen(false)} />}
      {shortcutsOpen && <ShortcutsOverlay onClose={() => setShortcutsOpen(false)} />}
    </div>
  );
}
