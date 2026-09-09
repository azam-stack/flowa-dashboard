import type { Dataset, FlowaTask, Meeting } from "@/schema";
import { computeAllAlerts, applyAlertState, type Alert, type AlertWithState } from "./alerts";
import { daysSince, todayISO } from "./dates";
import { formatDKK } from "./format";

/**
 * Turns alerts and ordinary overdue drift into a short, ranked, executable
 * list: "what do I do now, in the order it pays off best". Pure functions —
 * the formula lives here once, and its inputs are exposed on every action so
 * the UI can show them on hover instead of hiding the reasoning.
 */

export type InlineActionType =
  | "godkend_møde"
  | "afvis_møde"
  | "marker_prospect_kontaktet"
  | "udfør_task"
  | "gå_til";

export interface InlineAction {
  type: InlineActionType;
  entityId: string;
}

export interface ActionScore {
  konsekvens: number; // 1-5 — what it costs to let this slide
  hastende: number; // 1-5 — how fast the window closes
  indsats: number; // 1-5 — effort required (lower is easier)
  total: number;
}

export interface NextAction {
  id: string;
  titel: string;
  begrundelse: string;
  route: string;
  inline?: InlineAction;
  score: ActionScore;
  kilde: { type: "alarm" | "task" | "møde"; id: string };
}

/**
 * The one formula. Consequence matters most (losing a client outweighs a
 * cold prospect), urgency next (a closing window beats a slow one), effort
 * last (a five-minute fix beats a two-hour one at equal payoff).
 */
export function scoreAction(konsekvens: number, hastende: number, indsats: number): ActionScore {
  const total = konsekvens * 3 + hastende * 2 + (6 - indsats) * 1;
  return { konsekvens, hastende, indsats, total };
}

function consequenceFromAlert(a: Alert): number {
  if (a.kategori === "levering" || a.kategori === "økonomi" || a.kategori === "kontrakt") return a.niveau === "kritisk" ? 5 : 4;
  if (a.kategori === "godkendelse" || a.kategori === "afvisningsmønster") return a.niveau === "kritisk" ? 4 : 3;
  if (a.kategori === "kampagne" || a.kategori === "infrastruktur") return a.niveau === "kritisk" ? 4 : 3;
  return a.niveau === "kritisk" ? 3 : 2; // eget_salg
}

function urgencyFromAlert(a: Alert): number {
  const age = daysSince(a.opstået);
  if (age >= 14) return 5;
  if (age >= 7) return 4;
  if (age >= 3) return 3;
  return 2;
}

function effortFromAlert(a: Alert): number {
  switch (a.kategori) {
    case "godkendelse":
      return 1; // approve/reject inline
    case "eget_salg":
      return 2; // a call or a short message
    case "kontrakt":
    case "afvisningsmønster":
      return 4; // needs a real conversation or campaign rework
    default:
      return 3;
  }
}

function actionFromAlert(a: AlertWithState): NextAction {
  return {
    id: `alarm:${a.id}`,
    titel: a.handling,
    begrundelse: a.konsekvens,
    route: a.handlingRoute,
    score: scoreAction(consequenceFromAlert(a), urgencyFromAlert(a), effortFromAlert(a)),
    kilde: { type: "alarm", id: a.id },
  };
}

function actionsFromPendingMeetings(ds: Dataset, ref: string): NextAction[] {
  // Individually actionable, inline-approvable items for meetings pending
  // approval — the alert already flags the pile; this offers the one-click fix.
  const pending = ds.meetings.filter((m) => m.godkendelse === "afventer" && m.status === "afholdt" && m.clientId);
  return pending
    .filter((m) => daysSince(m.godkendelseOpdateretDato, ref) >= ds.settings.alarmTærskler.godkendelseAfventerAdvarselDage)
    .map((m) => {
      const client = ds.clients.find((c) => c.id === m.clientId);
      const age = daysSince(m.godkendelseOpdateretDato, ref);
      return {
        id: `møde-godkend:${m.id}`,
        titel: `Godkend eller afvis mødet med ${m.prospectNavn} (${m.virksomhed}) hos ${client?.navn ?? m.clientId}`,
        begrundelse: `Har afventet i ${age} dage. ${client ? formatDKK(client.performanceBeløbPrMøde) : ""} i performance-honorar venter.`,
        route: `/mødekvalitet?client=${m.clientId}&filter=afventer`,
        inline: { type: "godkend_møde", entityId: m.id },
        score: scoreAction(3, age >= 9 ? 5 : 4, 1),
        kilde: { type: "møde", id: m.id },
      } satisfies NextAction;
    });
}

function actionsFromOverdueTasks(ds: Dataset, ref: string, alreadyCovered: Set<string>): NextAction[] {
  return ds.tasks
    .filter((t) => t.status !== "afsluttet" && t.forfaldsdato <= ref)
    .filter((t) => !(t.knyttetTil && alreadyCovered.has(`${t.knyttetTil.type}:${t.knyttetTil.id}`)))
    .map((t) => {
      const overdue = daysSince(t.forfaldsdato, ref);
      const prioMap: Record<FlowaTask["prioritet"], number> = { kritisk: 5, høj: 4, mellem: 3, lav: 2 };
      return {
        id: `task:${t.id}`,
        titel: t.titel,
        begrundelse: overdue > 0 ? `Forfaldt for ${overdue} dage siden.` : "Forfalder i dag.",
        route: "/tasks",
        inline: { type: "udfør_task", entityId: t.id },
        score: scoreAction(prioMap[t.prioritet], overdue > 0 ? 5 : 3, 2),
        kilde: { type: "task", id: t.id },
      } satisfies NextAction;
    });
}

export interface NextActionsResult {
  actions: NextAction[];
  totalCandidates: number;
}

export function computeNextActions(ds: Dataset, ref: string = todayISO(), limit = 7): NextActionsResult {
  const alerts = computeAllAlerts(ds, ref);
  const { active } = applyAlertState(alerts, ds, ref);

  const fromAlerts = active
    // the pending-approval *alert* is a summary; the per-meeting actions below replace it 1:1 with inline execution
    .filter((a) => a.kategori !== "godkendelse" || !a.id.startsWith("godkendelse-afventer"))
    .map(actionFromAlert);

  const fromMeetings = actionsFromPendingMeetings(ds, ref);
  const covered = new Set([
    ...active.map((a) => `${a.entitet.type}:${a.entitet.id}`),
    ...fromMeetings.map((a) => `${a.kilde.type}:${a.kilde.id}`),
  ]);
  const fromTasks = actionsFromOverdueTasks(ds, ref, covered);

  const all = [...fromAlerts, ...fromMeetings, ...fromTasks];
  // de-dupe: keep the highest-scoring action per underlying entity
  const byEntity = new Map<string, NextAction>();
  for (const a of all) {
    const key = `${a.kilde.type}:${a.kilde.id}`;
    const existing = byEntity.get(key);
    if (!existing || a.score.total > existing.score.total) byEntity.set(key, a);
  }
  const deduped = [...byEntity.values()].sort((a, b) => b.score.total - a.score.total);
  return { actions: deduped.slice(0, limit), totalCandidates: deduped.length };
}

export function approveOrRejectExplainer(meeting: Meeting): string {
  return meeting.godkendelse === "afventer" ? "Afventer din beslutning" : meeting.godkendelse === "godkendt" ? "Godkendt" : "Afvist";
}
