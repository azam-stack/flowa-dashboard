const SHORTCUTS: Array<[string, string]> = [
  ["⌘K / Ctrl+K", "Åbn kommandopalette"],
  ["N", "Hurtig-tilføj (møde, prospect, task, omkostning)"],
  ["?", "Vis denne oversigt"],
  ["Esc", "Luk dialog"],
];

export function ShortcutsOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-soft" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Genveje">
        <h3 className="font-display text-lg font-semibold text-ink-900">Tastaturgenveje</h3>
        <dl className="mt-3 space-y-2">
          {SHORTCUTS.map(([key, desc]) => (
            <div key={key} className="flex items-center justify-between text-sm">
              <dt className="text-ink-600">{desc}</dt>
              <dd>
                <kbd className="rounded border border-ink-200 bg-ink-50 px-1.5 py-0.5 text-xs text-ink-700">{key}</kbd>
              </dd>
            </div>
          ))}
        </dl>
        <button onClick={onClose} className="mt-4 w-full rounded-lg bg-ink-800 py-1.5 text-sm font-medium text-white hover:bg-ink-900">
          Luk
        </button>
      </div>
    </div>
  );
}
