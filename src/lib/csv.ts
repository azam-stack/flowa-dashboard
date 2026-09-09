export function toCSV<T extends Record<string, unknown>>(rows: T[], columns?: { key: keyof T; label: string }[]): string {
  if (rows.length === 0) return "";
  const cols = columns ?? Object.keys(rows[0]).map((k) => ({ key: k as keyof T, label: k }));
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = cols.map((c) => escape(c.label)).join(";");
  const body = rows.map((r) => cols.map((c) => escape(r[c.key])).join(";")).join("\n");
  return `${header}\n${body}`;
}

export function downloadCSV(filename: string, csv: string) {
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
