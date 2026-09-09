import { Download } from "lucide-react";
import { toCSV, downloadCSV } from "@/lib/csv";

export function ExportButton<T extends Record<string, unknown>>({
  rows,
  filename,
  columns,
  label = "Eksportér CSV",
}: {
  rows: T[];
  filename: string;
  columns?: { key: keyof T; label: string }[];
  label?: string;
}) {
  return (
    <button
      onClick={() => downloadCSV(filename, toCSV(rows, columns))}
      disabled={rows.length === 0}
      className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 px-3 py-1.5 text-sm font-medium text-ink-600 hover:bg-ink-50 disabled:opacity-40"
    >
      <Download size={14} /> {label}
    </button>
  );
}
