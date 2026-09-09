import type { Settings } from "@/schema";

export function parseISO(d: string): Date {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

export function fmtISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function todayISO(): string {
  return fmtISO(new Date());
}

export function addDaysISO(d: string, n: number): string {
  const dt = parseISO(d);
  dt.setUTCDate(dt.getUTCDate() + n);
  return fmtISO(dt);
}

/** Whole days between two ISO dates (to - from). Negative if `to` is before `from`. */
export function daysBetween(from: string, to: string): number {
  const a = parseISO(from).getTime();
  const b = parseISO(to).getTime();
  return Math.round((b - a) / 86400000);
}

export function daysSince(d: string, ref: string = todayISO()): number {
  return daysBetween(d, ref);
}

export function isWorkday(dateISO: string, settings: Settings): boolean {
  const dow = parseISO(dateISO).getUTCDay();
  if (!settings.arbejdsdage.includes(dow)) return false;
  if (settings.helligdage.includes(dateISO)) return false;
  return true;
}

export function monthOf(dateISO: string): string {
  return dateISO.slice(0, 7);
}

export function monthBounds(monthKey: string): { start: string; end: string } {
  const [y, m] = monthKey.split("-").map(Number);
  const start = `${monthKey}-01`;
  const end = fmtISO(new Date(Date.UTC(y, m, 0)));
  return { start, end };
}

/** Workdays in [start, end] inclusive. */
export function workdaysInRange(start: string, end: string, settings: Settings): string[] {
  const out: string[] = [];
  let cur = start;
  while (cur <= end) {
    if (isWorkday(cur, settings)) out.push(cur);
    cur = addDaysISO(cur, 1);
  }
  return out;
}

/** Workday-based pacing info for the current month: elapsed/total workdays plus the split. */
export function monthPacing(monthKey: string, settings: Settings, refDateISO: string = todayISO()) {
  const { start, end } = monthBounds(monthKey);
  const allWorkdays = workdaysInRange(start, end, settings);
  const elapsedWorkdays = allWorkdays.filter((d) => d <= refDateISO).length;
  const remainingWorkdays = allWorkdays.length - elapsedWorkdays;
  return {
    totalWorkdays: allWorkdays.length,
    elapsedWorkdays,
    remainingWorkdays,
    fractionElapsed: allWorkdays.length === 0 ? 1 : elapsedWorkdays / allWorkdays.length,
  };
}

const DA_MONTHS = ["januar", "februar", "marts", "april", "maj", "juni", "juli", "august", "september", "oktober", "november", "december"];
export function formatDateDa(dateISO: string): string {
  const d = parseISO(dateISO);
  return `${d.getUTCDate()}. ${DA_MONTHS[d.getUTCMonth()]}`;
}
