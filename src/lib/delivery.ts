import type { Client, Dataset } from "@/schema";
import { meetingsCountingTowardQuota, clientHealthScore } from "./alerts";
import { monthOf, monthPacing, monthBounds, todayISO, daysSince, workdaysInRange } from "./dates";

export interface MonthDeliverySummary {
  monthKey: string;
  kvote: number;
  leveret: number;
  pacing: ReturnType<typeof monthPacing>;
  forventetNu: number;
  ratio: number;
  perResterendeArbejdsdag: number | null;
  hidtilPerArbejdsdag: number;
  prognose: number;
  vurdering: "sund" | "advarsel" | "kritisk";
}

export function monthDeliverySummary(client: Client, ds: Dataset, ref: string = todayISO()): MonthDeliverySummary {
  const monthKey = monthOf(ref);
  const pacing = monthPacing(monthKey, ds.settings, ref);
  const leveret = meetingsCountingTowardQuota(ds.meetings, client.id, monthKey).length;
  const kvote = client.aftalteMøderPrMd;
  const forventetNu = kvote * pacing.fractionElapsed;
  const ratio = forventetNu <= 0 ? (leveret > 0 ? 1 : 0) : leveret / forventetNu;
  const hidtilPerArbejdsdag = pacing.elapsedWorkdays > 0 ? leveret / pacing.elapsedWorkdays : 0;
  const perResterendeArbejdsdag = pacing.remainingWorkdays > 0 ? Math.max(0, kvote - leveret) / pacing.remainingWorkdays : null;
  const prognose = Math.round(hidtilPerArbejdsdag * pacing.totalWorkdays);
  const vurdering: MonthDeliverySummary["vurdering"] = ratio >= 0.85 ? "sund" : ratio < 0.5 ? "kritisk" : "advarsel";
  return { monthKey, kvote, leveret, pacing, forventetNu, ratio, perResterendeArbejdsdag, hidtilPerArbejdsdag, prognose, vurdering };
}

export interface ContractDeliverySummary {
  monthsSpanned: string[];
  totalExpected: number;
  totalDelivered: number;
  grad: number;
}

export function cumulativeContractDelivery(client: Client, ds: Dataset, ref: string = todayISO()): ContractDeliverySummary {
  const months: string[] = [];
  let cursor = monthOf(client.startDato);
  const currentMonth = monthOf(ref);
  while (cursor <= currentMonth) {
    months.push(cursor);
    const [y, m] = cursor.split("-").map(Number);
    const next = new Date(Date.UTC(y, m, 1));
    cursor = next.toISOString().slice(0, 7);
  }
  let totalExpected = 0;
  let totalDelivered = 0;
  for (const monthKey of months) {
    const { start, end } = monthBounds(monthKey);
    const clippedStart = start < client.startDato ? client.startDato : start;
    const clippedEnd = end > ref ? ref : end;
    if (clippedStart > clippedEnd) continue;
    const monthWorkdays = workdaysInRange(start, end, ds.settings);
    const countedWorkdays = workdaysInRange(clippedStart, clippedEnd, ds.settings);
    const fraction = monthWorkdays.length > 0 ? countedWorkdays.length / monthWorkdays.length : 0;
    totalExpected += client.aftalteMøderPrMd * fraction;
    totalDelivered += meetingsCountingTowardQuota(ds.meetings, client.id, monthKey).length;
  }
  const grad = totalExpected > 0 ? totalDelivered / totalExpected : 1;
  return { monthsSpanned: months, totalExpected: Math.round(totalExpected), totalDelivered, grad };
}

export function contractCountdown(client: Client, ref: string = todayISO()) {
  if (!client.kontraktSlut) return null;
  const daysToEnd = daysSince(ref, client.kontraktSlut);
  const noticeDeadline = daysToEnd - client.opsigelsesvarsel;
  return { daysToEnd, noticeDeadline };
}

export { clientHealthScore };
