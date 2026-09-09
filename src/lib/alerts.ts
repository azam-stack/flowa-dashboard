import type { Client, Dataset, Meeting } from "@/schema";
import { addDaysISO, daysSince, monthOf, monthPacing, todayISO } from "./dates";
import { formatDKK, formatNumber, formatPercent } from "./format";

/**
 * The alert engine. Pure functions only: given the full dataset and settings,
 * return a ranked list of alerts. No component decides on its own that
 * something is red — every screen renders what this file computes.
 */

export type AlertLevel = "kritisk" | "advarsel" | "sund";
export type AlertKategori =
  | "levering"
  | "godkendelse"
  | "afvisningsmønster"
  | "kampagne"
  | "infrastruktur"
  | "eget_salg"
  | "økonomi"
  | "kontrakt";

export interface AlertEntity {
  type: "klient" | "prospect" | "møde" | "kampagne" | "infrastruktur" | "faktura";
  id: string;
  label: string;
}

export interface Alert {
  /** stable across runs — used as the snooze key in alerts_state.json */
  id: string;
  niveau: AlertLevel;
  kategori: AlertKategori;
  titel: string;
  konsekvens: string;
  handling: string;
  handlingRoute: string;
  entitet: AlertEntity;
  vægt: number;
  /** ISO date the underlying condition first appeared — drives the "aging" indicator */
  opstået: string;
  /** raw numbers behind the sentence, for hover / debugging / tests */
  detaljer?: Record<string, number | string>;
}

export interface AlertWithState extends Alert {
  udsat: boolean;
  udsatTil?: string;
  begrundelse?: string;
}

const LEVEL_BASE: Record<AlertLevel, number> = { kritisk: 10_000, advarsel: 5_000, sund: 0 };

function alert(partial: Omit<Alert, "vægt"> & { magnitude?: number }): Alert {
  const { magnitude = 0, ...rest } = partial;
  return { ...rest, vægt: LEVEL_BASE[rest.niveau] + magnitude };
}

// ---------------------------------------------------------------------------
// LEVERING — delivery pace, silence, contract renewal
// ---------------------------------------------------------------------------

export function meetingsCountingTowardQuota(meetings: Meeting[], clientId: string, monthKey: string): Meeting[] {
  return meetings.filter((m) => m.clientId === clientId && monthOf(m.booketDato) === monthKey && m.status !== "aflyst");
}

function deliveryAlertForClient(client: Client, ds: Dataset, ref: string): Alert | null {
  if (client.status !== "aktiv" && client.status !== "onboarding") return null;
  const monthKey = monthOf(ref);
  const pacing = monthPacing(monthKey, ds.settings, ref);
  const leveret = meetingsCountingTowardQuota(ds.meetings, client.id, monthKey).length;
  const kvote = client.aftalteMøderPrMd;
  const expectedByNow = kvote * pacing.fractionElapsed;
  const ratio = expectedByNow <= 0 ? (leveret > 0 ? 1 : 0) : leveret / expectedByNow;

  const held = ds.meetings.filter((m) => m.clientId === client.id && m.status === "afholdt");
  const lastHeldDate = held.length ? held.map((m) => m.mødeDato).sort().at(-1)! : null;
  const daysSinceLastMeeting = lastHeldDate ? daysSince(lastHeldDate, ref) : daysSince(client.startDato, ref);
  const silent = daysSinceLastMeeting >= ds.settings.alarmTærskler.kundeIngenLeveringDage;

  if (ratio >= 0.85 && !silent) return null; // on pace, nothing to say

  const niveau: AlertLevel = ratio < 0.5 ? "kritisk" : "advarsel";
  const mangler = Math.max(0, kvote - leveret);
  const perDay = pacing.remainingWorkdays > 0 ? mangler / pacing.remainingWorkdays : null;
  const hidtilPerDay = pacing.elapsedWorkdays > 0 ? leveret / pacing.elapsedWorkdays : 0;

  // Fold in a collapsing/quiet campaign as the same cause, not a second alert (see campaign rules below).
  const clientCampaigns = ds.campaigns.filter((c) => c.clientId === client.id);
  const collapsedCampaign = clientCampaigns
    .map((c) => campaignReplyRateDrop(c, ds, ref))
    .find((x) => x !== null);

  const titel = silent && ratio < 0.85
    ? `${client.navn} er bagud på kvoten — ingen leverede møder i ${formatNumber(daysSinceLastMeeting)} dage`
    : `${client.navn} er bagud på kvoten — ${formatNumber(leveret)} af ${formatNumber(kvote)} møder leveret`;

  let konsekvens = perDay
    ? `Mangler ${formatNumber(mangler)} møder med ${formatNumber(pacing.remainingWorkdays)} arbejdsdage tilbage af måneden. Kræver ${formatNumber(perDay, 2)} møder/dag mod ${formatNumber(hidtilPerDay, 2)} hidtil.`
    : `Mangler ${formatNumber(mangler)} møder, og måneden er slut på arbejdsdage — kvoten kan ikke nås som planlagt.`;

  let handling = `Gennemgå leveringen med ${client.navn} og book ekstra kapacitet resten af måneden.`;
  if (collapsedCampaign) {
    konsekvens += ` Årsagen ser ud til at være kampagnen "${collapsedCampaign.entitet.label}": ${collapsedCampaign.konsekvens}`;
    handling = collapsedCampaign.handling;
  }

  return alert({
    id: `levering-bagud:${client.id}`,
    niveau,
    kategori: "levering",
    titel,
    konsekvens,
    handling,
    handlingRoute: `/levering/${client.id}`,
    entitet: { type: "klient", id: client.id, label: client.navn },
    opstået: lastHeldDate ?? client.startDato,
    magnitude: Math.round((1 - Math.min(ratio, 1)) * 400) + Math.min(daysSinceLastMeeting, 30) * 5,
    detaljer: { leveret, kvote, ratio: Math.round(ratio * 100), mangler, perDay: perDay ?? -1, daysSinceLastMeeting },
  });
}

function contractRenewalAlert(client: Client, ds: Dataset, ref: string): Alert | null {
  if (!client.kontraktSlut || client.status !== "aktiv") return null;
  const daysToEnd = daysSince(ref, client.kontraktSlut);
  if (daysToEnd > ds.settings.alarmTærskler.opsigelsesvarselAdvarselDage || daysToEnd < 0) return null;
  const health = clientHealthScore(client, ds, ref);
  if (health.niveau === "sund") return null; // renewal approaching but delivery is fine — not an alarm
  return alert({
    id: `kontrakt-fornyelse:${client.id}`,
    niveau: health.niveau === "kritisk" ? "kritisk" : "advarsel",
    kategori: "kontrakt",
    titel: `${client.navn}s kontrakt kan opsiges om ${formatNumber(daysToEnd)} dage, og leveringen er ikke i orden`,
    konsekvens: `Opsigelsesvarsel på ${formatNumber(client.opsigelsesvarsel)} dage nærmer sig, og ${health.begrundelse.toLowerCase()}`,
    handling: `Book en status med ${client.navn} nu og vis en konkret plan for at rette leveringen op før fornyelsen.`,
    handlingRoute: `/levering/${client.id}`,
    entitet: { type: "klient", id: client.id, label: client.navn },
    opstået: addDaysISO(client.kontraktSlut, -client.opsigelsesvarsel),
    magnitude: 300 + Math.max(0, 30 - daysToEnd) * 6,
    detaljer: { daysToEnd, healthScore: health.score },
  });
}

// ---------------------------------------------------------------------------
// health score (used by delivery + churn risk)
// ---------------------------------------------------------------------------

export function clientHealthScore(client: Client, ds: Dataset, ref: string = todayISO()) {
  const w = ds.settings.healthScore.vægte;
  const monthKey = monthOf(ref);
  const pacing = monthPacing(monthKey, ds.settings, ref);
  const leveret = meetingsCountingTowardQuota(ds.meetings, client.id, monthKey).length;
  const leveringsgrad = Math.min(1, leveret / Math.max(1, client.aftalteMøderPrMd * pacing.fractionElapsed || client.aftalteMøderPrMd));

  const decided = ds.meetings.filter((m) => m.clientId === client.id && (m.godkendelse === "godkendt" || m.godkendelse === "afvist"));
  const godkendt = decided.filter((m) => m.godkendelse === "godkendt").length;
  const godkendelsesrate = decided.length > 0 ? godkendt / decided.length : 1;

  const held = ds.meetings.filter((m) => m.clientId === client.id && m.status === "afholdt");
  const lastHeldDate = held.length ? held.map((m) => m.mødeDato).sort().at(-1)! : null;
  const daysSinceLastMeeting = lastHeldDate ? daysSince(lastHeldDate, ref) : daysSince(client.startDato, ref);
  const silenceScore = Math.max(0, 1 - daysSinceLastMeeting / 21);

  const score = Math.round(100 * (w.leveringsgrad * leveringsgrad + w.godkendelsesrate * godkendelsesrate + w.dageSidenLeveretMøde * silenceScore));
  const niveau: AlertLevel = score < ds.settings.healthScore.kritiskUnder ? "kritisk" : score < ds.settings.healthScore.advarselUnder ? "advarsel" : "sund";

  const reasons: string[] = [];
  if (leveringsgrad < 0.85) reasons.push(`leveringsgraden ligger på ${formatPercent(leveringsgrad)} af forventet tempo`);
  if (godkendelsesrate < 0.85 && decided.length > 0) reasons.push(`kun ${formatPercent(godkendelsesrate)} af møderne bliver godkendt`);
  if (daysSinceLastMeeting > 7) reasons.push(`der er ${formatNumber(daysSinceLastMeeting)} dage siden sidste leverede møde`);
  const begrundelse =
    niveau === "sund"
      ? reasons.length
        ? `Stort set sundt, men hold øje: ${reasons.join(", og ")}.`
        : "Alt kører efter planen."
      : `Churn-risiko fordi ${reasons.join(", og ")}.`;

  return { score, niveau, leveringsgrad, godkendelsesrate, daysSinceLastMeeting, begrundelse };
}

// ---------------------------------------------------------------------------
// MØDEKVALITET
// ---------------------------------------------------------------------------

function approvalRateAlert(client: Client, ds: Dataset, ref: string): Alert | null {
  const decided = ds.meetings.filter((m) => m.clientId === client.id && (m.godkendelse === "godkendt" || m.godkendelse === "afvist"));
  if (decided.length < 4) return null;
  const rate = decided.filter((m) => m.godkendelse === "godkendt").length / decided.length;
  const t = ds.settings.alarmTærskler;
  if (rate * 100 >= t.godkendelsesrateAdvarselProcent) return null;
  const niveau: AlertLevel = rate * 100 < t.godkendelsesrateKritiskProcent ? "kritisk" : "advarsel";
  return alert({
    id: `godkendelsesrate:${client.id}`,
    niveau,
    kategori: "godkendelse",
    titel: `${client.navn} godkender kun ${formatPercent(rate)} af møderne`,
    konsekvens: `${formatNumber(decided.length - decided.filter((m) => m.godkendelse === "godkendt").length)} møder er afvist ud af ${formatNumber(decided.length)} — under tærsklen på ${t.godkendelsesrateAdvarselProcent}%. Performance-honoraret rammes direkte, og det er et tegn på targeting-problemer.`,
    handling: `Gennemgå afvisningsårsager for ${client.navn} og stram ICP i kampagnen.`,
    handlingRoute: `/mødekvalitet?client=${client.id}`,
    entitet: { type: "klient", id: client.id, label: client.navn },
    opstået: decided.map((m) => m.mødeDato).sort().at(-Math.ceil(decided.length / 3))!,
    magnitude: Math.round((1 - rate) * 300),
    detaljer: { rate: Math.round(rate * 100), n: decided.length },
  });
}

function pendingApprovalAlert(client: Client, ds: Dataset, ref: string): Alert | null {
  const pending = ds.meetings.filter((m) => m.clientId === client.id && m.godkendelse === "afventer" && m.status === "afholdt");
  if (pending.length === 0) return null;
  const t = ds.settings.alarmTærskler;
  const ages = pending.map((m) => ({ m, age: daysSince(m.godkendelseOpdateretDato, ref) }));
  const oldest = ages.reduce((a, b) => (b.age > a.age ? b : a));
  if (oldest.age < t.godkendelseAfventerAdvarselDage) return null;
  const beløb = pending.length * client.performanceBeløbPrMøde;
  const niveau: AlertLevel = oldest.age >= t.godkendelseAfventerKritiskDage ? "kritisk" : "advarsel";
  return alert({
    id: `godkendelse-afventer:${client.id}`,
    niveau,
    kategori: "godkendelse",
    titel: `${formatNumber(pending.length)} møder hos ${client.navn} afventer godkendelse — det ældste i ${formatNumber(oldest.age)} dage`,
    konsekvens: `${formatDKK(beløb)} i performance-honorar står ufaktureret, så længe møderne ikke er godkendt.`,
    handling: `Godkend eller afvis de ventende møder hos ${client.navn} nu.`,
    handlingRoute: `/mødekvalitet?client=${client.id}&filter=afventer`,
    entitet: { type: "klient", id: client.id, label: client.navn },
    opstået: oldest.m.godkendelseOpdateretDato,
    magnitude: oldest.age * 8 + pending.length * 4,
    detaljer: { antal: pending.length, ældsteDage: oldest.age, beløb },
  });
}

function rejectionPatternAlert(client: Client, ds: Dataset, ref: string): Alert | null {
  const recent = ds.meetings.filter((m) => m.clientId === client.id && m.godkendelse === "afvist" && m.afvisningsårsag && daysSince(m.godkendelseOpdateretDato, ref) <= 30);
  const previous = ds.meetings.filter((m) => m.clientId === client.id && m.godkendelse === "afvist" && m.afvisningsårsag && daysSince(m.godkendelseOpdateretDato, ref) > 30 && daysSince(m.godkendelseOpdateretDato, ref) <= 60);
  if (recent.length < 3) return null;
  const counts = new Map<string, number>();
  for (const m of recent) counts.set(m.afvisningsårsag!, (counts.get(m.afvisningsårsag!) ?? 0) + 1);
  const [topReason, topCount] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  const share = topCount / recent.length;
  const prevCount = previous.filter((m) => m.afvisningsårsag === topReason).length;
  const t = ds.settings.alarmTærskler;
  const growth = prevCount === 0 ? (topCount >= 3 ? 100 : 0) : ((topCount - prevCount) / prevCount) * 100;
  if (share < 0.4 || growth < t.afvisningsårsagStigningProcent) return null;

  const REASON_LABEL: Record<string, string> = {
    forkert_icp: "forkert ICP", ikke_beslutningstager: "ikke beslutningstager", intet_reelt_behov: "intet reelt behov",
    dårligt_timet: "dårligt timet", kunde_dukkede_ikke_op: "kunden dukkede ikke op",
  };
  return alert({
    id: `afvisningsmønster:${client.id}:${topReason}`,
    niveau: share > 0.6 ? "kritisk" : "advarsel",
    kategori: "afvisningsmønster",
    titel: `${formatPercent(share)} af afviste møder hos ${client.navn} skyldes "${REASON_LABEL[topReason]}"`,
    konsekvens: `${formatNumber(topCount)} af de seneste ${formatNumber(recent.length)} afvisninger har samme årsag — det er ikke tilfældigt, det er et targeting-problem i kampagnen.`,
    handling: `Stram ICP-kriterierne i kampagnen for ${client.navn} og gennemgå listen for dårlige matches.`,
    handlingRoute: `/mødekvalitet?client=${client.id}`,
    entitet: { type: "klient", id: client.id, label: client.navn },
    opstået: addDaysISO(ref, -30),
    magnitude: Math.round(share * 150) + Math.round(Math.min(growth, 200) / 2),
    detaljer: { topReason, topCount, recentTotal: recent.length, growth: Math.round(growth) },
  });
}

// ---------------------------------------------------------------------------
// KAMPAGNER
// ---------------------------------------------------------------------------

function campaignReplyRateDrop(campaign: Dataset["campaigns"][number], ds: Dataset, ref: string): Alert | null {
  if (campaign.kanal !== "email" || campaign.status !== "aktiv") return null;
  const rows = ds.outreach.filter((o) => o.campaignId === campaign.id);
  const recent = rows.filter((o) => daysSince(o.dato, ref) <= 14 && daysSince(o.dato, ref) >= 0);
  const previous = rows.filter((o) => daysSince(o.dato, ref) > 14 && daysSince(o.dato, ref) <= 28);
  const sum = (arr: typeof rows, k: "emailsSendt" | "positiveSvar") => arr.reduce((s, r) => s + r[k], 0);
  const recentSent = sum(recent, "emailsSendt");
  const prevSent = sum(previous, "emailsSendt");
  if (recentSent < 50 || prevSent < 50) return null;
  const recentRate = sum(recent, "positiveSvar") / recentSent;
  const prevRate = sum(previous, "positiveSvar") / prevSent;
  if (prevRate <= 0) return null;
  const relativeDrop = (1 - recentRate / prevRate) * 100;
  const t = ds.settings.alarmTærskler;
  if (relativeDrop < t.positivSvarrateFaldProcent) return null;

  const owner = campaign.clientId ? ds.clients.find((c) => c.id === campaign.clientId) : null;
  const scope = owner ? owner.navn : "Flowas eget salg";
  return alert({
    id: `kampagne-fald:${campaign.id}`,
    niveau: relativeDrop >= 40 ? "kritisk" : "advarsel",
    kategori: "kampagne",
    titel: `Positiv svarrate faldet ${formatNumber(relativeDrop)}% på kampagnen "${campaign.navn}"`,
    konsekvens: `Fra ${formatPercent(prevRate, 1)} til ${formatPercent(recentRate, 1)} på to uger (${scope}). Uden rettelse rammer det møde-tempoet i næste periode.`,
    handling: `Gennemgå kampagne "${campaign.navn}" — tjek emnelinjer, afsenderdomæne og seneste listeimport.`,
    handlingRoute: `/kampagner/${campaign.id}`,
    entitet: { type: "kampagne", id: campaign.id, label: campaign.navn },
    opstået: addDaysISO(ref, -14),
    magnitude: Math.round(relativeDrop) * 3,
    detaljer: { recentRate: Math.round(recentRate * 1000) / 10, prevRate: Math.round(prevRate * 1000) / 10, relativeDrop: Math.round(relativeDrop) },
  });
}

function campaignNoMeetingsAlert(campaign: Dataset["campaigns"][number], ds: Dataset, ref: string): Alert | null {
  if (campaign.status !== "aktiv") return null;
  const t = ds.settings.alarmTærskler;
  if (daysSince(campaign.startDato, ref) < t.kampagneIngenMøderDage) return null;
  const rows = ds.outreach.filter((o) => o.campaignId === campaign.id).sort((a, b) => (a.dato < b.dato ? 1 : -1));
  const lastMeetingRow = rows.find((o) => o.møderSat > 0);
  const daysSinceLastMeeting = lastMeetingRow ? daysSince(lastMeetingRow.dato, ref) : daysSince(campaign.startDato, ref);
  if (daysSinceLastMeeting < t.kampagneIngenMøderDage) return null;
  const owner = campaign.clientId ? ds.clients.find((c) => c.id === campaign.clientId) : null;
  return alert({
    id: `kampagne-stille:${campaign.id}`,
    niveau: daysSinceLastMeeting >= t.kampagneIngenMøderDage * 1.5 ? "kritisk" : "advarsel",
    kategori: "kampagne",
    titel: `Kampagnen "${campaign.navn}" har ikke sat et møde i ${formatNumber(daysSinceLastMeeting)} dage`,
    konsekvens: owner ? `Det går direkte ud over leveringen til ${owner.navn}.` : "Det bremser Flowas eget pipeline-flow.",
    handling: `Sæt kampagnen "${campaign.navn}" under lup — er listen brugt op, eller er responsraten kollapset?`,
    handlingRoute: `/kampagner/${campaign.id}`,
    entitet: { type: "kampagne", id: campaign.id, label: campaign.navn },
    opstået: lastMeetingRow?.dato ?? campaign.startDato,
    magnitude: daysSinceLastMeeting * 4,
    detaljer: { daysSinceLastMeeting },
  });
}

function costPerMeetingAlert(campaign: Dataset["campaigns"][number], ds: Dataset, ref: string): Alert | null {
  if (campaign.kanal !== "email" || campaign.status !== "aktiv") return null;
  const rows = ds.outreach.filter((o) => o.campaignId === campaign.id);
  const recent = rows.filter((o) => daysSince(o.dato, ref) <= 30 && daysSince(o.dato, ref) >= 0);
  const previous = rows.filter((o) => daysSince(o.dato, ref) > 30 && daysSince(o.dato, ref) <= 60);
  const ratio = (arr: typeof rows) => {
    const sent = arr.reduce((s, r) => s + r.emailsSendt, 0);
    const møder = arr.reduce((s, r) => s + r.møderSat, 0);
    return møder > 0 ? sent / møder : null;
  };
  const recentRatio = ratio(recent);
  const prevRatio = ratio(previous);
  if (recentRatio === null || prevRatio === null) return null;
  const t = ds.settings.alarmTærskler;
  const worsenPct = ((recentRatio - prevRatio) / prevRatio) * 100;
  if (worsenPct < t.mailsPrMødeForværringProcent) return null;
  return alert({
    id: `kampagne-effektivitet:${campaign.id}`,
    niveau: worsenPct >= t.mailsPrMødeForværringProcent * 1.5 ? "kritisk" : "advarsel",
    kategori: "kampagne",
    titel: `Kampagnen "${campaign.navn}" bruger nu ${formatNumber(recentRatio)} mails pr. booket møde, mod ${formatNumber(prevRatio)} tidligere`,
    konsekvens: `Rentabiliteten i kampagnen er forværret ${formatNumber(worsenPct)}% — samme resultat koster markant mere afsendervolumen.`,
    handling: `Revider målgruppe og copy i "${campaign.navn}" før flere mails sendes.`,
    handlingRoute: `/kampagner/${campaign.id}`,
    entitet: { type: "kampagne", id: campaign.id, label: campaign.navn },
    opstået: addDaysISO(ref, -30),
    magnitude: Math.round(worsenPct),
    detaljer: { recentRatio: Math.round(recentRatio), prevRatio: Math.round(prevRatio), worsenPct: Math.round(worsenPct) },
  });
}

// ---------------------------------------------------------------------------
// INFRASTRUKTUR
// ---------------------------------------------------------------------------

function infrastructureAlerts(ds: Dataset, ref: string): Alert[] {
  const t = ds.settings.alarmTærskler;
  const out: Alert[] = [];
  for (const domain of ds.infrastructure) {
    if (domain.status === "brændt") {
      out.push(alert({
        id: `infra-brændt:${domain.id}`,
        niveau: "kritisk",
        kategori: "infrastruktur",
        titel: `Domænet ${domain.domæne} er markeret som brændt`,
        konsekvens: `${formatNumber(domain.dagligSendekapacitet)} mails/dag i sendekapacitet er ude af drift, og fortsat afsendelse skader domænets renommé yderligere.`,
        handling: `Pause afsendelse fra ${domain.domæne} og flyt volumen til et sundt domæne.`,
        handlingRoute: `/infrastruktur`,
        entitet: { type: "infrastruktur", id: domain.id, label: domain.domæne },
        opstået: domain.oprettet,
        magnitude: 200,
        detaljer: { bounceRate7d: domain.bounceRate7d, spamklager: domain.spamklager },
      }));
      continue;
    }
    if (domain.bounceRate7d >= t.bounceRateAdvarselProcent) {
      const niveau: AlertLevel = domain.bounceRate7d >= t.bounceRateKritiskProcent ? "kritisk" : "advarsel";
      out.push(alert({
        id: `infra-bounce:${domain.id}`,
        niveau,
        kategori: "infrastruktur",
        titel: `${domain.domæne} har ${formatPercent(domain.bounceRate7d / 100, 1)} bounce rate de seneste 7 dage`,
        konsekvens: niveau === "kritisk" ? "Domænets afsenderrygte er i fare — fortsætter det, brænder domænet, og kapaciteten forsvinder helt." : "Nærmer sig kritisk niveau. Uden handling ender domænet brændt.",
        handling: `Verificér listen bag ${domain.domæne} og sænk sendevolumen, til bounce raten er under kontrol.`,
        handlingRoute: `/infrastruktur`,
        entitet: { type: "infrastruktur", id: domain.id, label: domain.domæne },
        opstået: addDaysISO(ref, -7),
        magnitude: Math.round(domain.bounceRate7d * 20),
        detaljer: { bounceRate7d: domain.bounceRate7d },
      }));
    }
  }

  const healthyCapacity = ds.infrastructure.filter((d) => d.status !== "brændt").reduce((s, d) => s + d.dagligSendekapacitet, 0);
  const activeEmailCampaigns = ds.campaigns.filter((c) => c.kanal === "email" && c.status === "aktiv");
  let requiredDaily = 0;
  for (const c of activeEmailCampaigns) {
    const rows = ds.outreach.filter((o) => o.campaignId === c.id && daysSince(o.dato, ref) <= 14 && daysSince(o.dato, ref) >= 0);
    const avg = rows.length ? rows.reduce((s, r) => s + r.emailsSendt, 0) / rows.length : 0;
    requiredDaily += avg;
  }
  if (healthyCapacity > 0 && requiredDaily > 0) {
    const utilization = (requiredDaily / healthyCapacity) * 100;
    if (utilization >= t.kapacitetKritiskProcent) {
      out.push(alert({
        id: `infra-kapacitet`,
        niveau: utilization >= 100 ? "kritisk" : "advarsel",
        kategori: "infrastruktur",
        titel: `Sendekapaciteten er ${formatPercent(utilization / 100)} udnyttet`,
        konsekvens: utilization >= 100 ? "De aktive kampagner kræver mere volumen, end infrastrukturen kan levere sundt — det presser bounce rate og leveringsevne op." : "Der er stort set intet råderum tilbage til at tage en ny kunde eller kampagne ind.",
        handling: "Skaf flere afsenderdomæner/indbakker, før der sælges mere volumen.",
        handlingRoute: `/kapacitet`,
        entitet: { type: "infrastruktur", id: "kapacitet", label: "Samlet sendekapacitet" },
        opstået: addDaysISO(ref, -14),
        magnitude: Math.round(utilization),
        detaljer: { requiredDaily: Math.round(requiredDaily), healthyCapacity, utilization: Math.round(utilization) },
      }));
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// EGET SALG
// ---------------------------------------------------------------------------

function prospectStaleAlerts(ds: Dataset, ref: string): Alert[] {
  const t = ds.settings.alarmTærskler;
  return ds.prospects
    .filter((p) => p.status !== "vundet" && p.status !== "tabt")
    .map((p) => {
      const age = daysSince(p.stadieSkiftetDato, ref);
      if (age < t.prospectStilstandDage) return null;
      return alert({
        id: `prospect-stille:${p.id}`,
        niveau: age >= t.prospectStilstandDage * 2 ? "kritisk" : "advarsel",
        kategori: "eget_salg",
        titel: `Ring til ${p.kontaktperson} hos ${p.virksomhed} — prospektet har stået stille i ${formatNumber(age)} dage`,
        konsekvens: `Estimeret månedlig værdi ${formatDKK(p.estimeretMånedligVærdi)} risikerer at gå koldt uden kontakt.`,
        handling: `Ring eller skriv til ${p.kontaktperson} i dag.`,
        handlingRoute: `/eget-salg?prospect=${p.id}`,
        entitet: { type: "prospect", id: p.id, label: p.virksomhed },
        opstået: p.stadieSkiftetDato,
        magnitude: age * 3,
        detaljer: { age, status: p.status },
      });
    })
    .filter((a): a is Alert => a !== null);
}

function offerFollowupAlerts(ds: Dataset, ref: string): Alert[] {
  const t = ds.settings.alarmTærskler;
  return ds.prospects
    .filter((p) => p.status === "tilbud_sendt")
    .map((p) => {
      if (!p.næsteHandlingDato) return null;
      const overdueDays = daysSince(p.næsteHandlingDato, ref);
      if (overdueDays < t.tilbudOpfølgningDage) return null;
      return alert({
        id: `tilbud-opfølgning:${p.id}`,
        niveau: overdueDays >= t.tilbudOpfølgningDage * 2 ? "kritisk" : "advarsel",
        kategori: "eget_salg",
        titel: `Følg op på tilbuddet til ${p.virksomhed}`,
        konsekvens: `Sendt for ${formatNumber(daysSince(p.stadieSkiftetDato, ref))} dage siden, ingen svar — ${formatDKK(p.estimeretMånedligVærdi)}/md i potentiel værdi hænger i det uvisse.`,
        handling: `Send en kort opfølgning til ${p.kontaktperson} hos ${p.virksomhed}.`,
        handlingRoute: `/eget-salg?prospect=${p.id}`,
        entitet: { type: "prospect", id: p.id, label: p.virksomhed },
        opstået: p.næsteHandlingDato,
        magnitude: overdueDays * 4,
        detaljer: { overdueDays },
      });
    })
    .filter((a): a is Alert => a !== null);
}

function lowActivityAlert(ds: Dataset, ref: string): Alert | null {
  const t = ds.settings.alarmTærskler;
  const ownCampaigns = ds.campaigns.filter((c) => c.clientId === null);
  const rows = ds.outreach.filter((o) => ownCampaigns.some((c) => c.id === o.campaignId) && daysSince(o.dato, ref) <= 7 && daysSince(o.dato, ref) >= 0);
  const samtaler = rows.reduce((s, r) => s + r.samtaler, 0) + rows.reduce((s, r) => s + r.svar, 0);
  if (samtaler >= t.egetSalgLavAktivitetSamtalerPrUge) return null;
  return alert({
    id: "eget-salg-lav-aktivitet",
    niveau: samtaler === 0 ? "kritisk" : "advarsel",
    kategori: "eget_salg",
    titel: `Kun ${formatNumber(samtaler)} nye samtaler i eget salg denne uge`,
    konsekvens: `Under målet på ${formatNumber(t.egetSalgLavAktivitetSamtalerPrUge)} om ugen — for lidt i toppen af tragten til at nå målet om nye kunder.`,
    handling: "Sæt en time af i dag til udgående opkald eller personlige beskeder.",
    handlingRoute: "/eget-salg",
    entitet: { type: "prospect", id: "eget-salg", label: "Flowas eget salg" },
    opstået: addDaysISO(ref, -7),
    magnitude: (t.egetSalgLavAktivitetSamtalerPrUge - samtaler) * 20,
    detaljer: { samtaler },
  });
}

// ---------------------------------------------------------------------------
// ØKONOMI
// ---------------------------------------------------------------------------

function overdueInvoiceAlerts(ds: Dataset, ref: string): Alert[] {
  return ds.invoices
    .filter((inv) => inv.status === "forfalden" || (inv.status === "sendt" && inv.forfaldsdato < ref))
    .map((inv) => {
      const client = ds.clients.find((c) => c.id === inv.clientId);
      const overdueDays = daysSince(inv.forfaldsdato, ref);
      return alert({
        id: `faktura-forfalden:${inv.id}`,
        niveau: overdueDays >= 14 ? "kritisk" : "advarsel",
        kategori: "økonomi",
        titel: `Faktura til ${client?.navn ?? inv.clientId} for ${inv.måned} er forfalden`,
        konsekvens: `${formatDKK(inv.total)} er ${formatNumber(overdueDays)} dage over forfald.`,
        handling: `Ryk ${client?.navn ?? "kunden"} for betaling.`,
        handlingRoute: `/økonomi?invoice=${inv.id}`,
        entitet: { type: "faktura", id: inv.id, label: `${client?.navn ?? inv.clientId} — ${inv.måned}` },
        opstået: inv.forfaldsdato,
        magnitude: overdueDays * 6,
        detaljer: { overdueDays, total: inv.total },
      });
    });
}

export function clientMonthlyEconomics(client: Client, ds: Dataset, ref: string = todayISO()) {
  const monthKey = monthOf(ref);
  const billable = ds.meetings.filter((m) => m.clientId === client.id && m.faktureres && monthOf(m.mødeDato) === monthKey).length;
  const performanceBeløb = billable * client.performanceBeløbPrMøde;
  const revenue = client.retainerBeløb + performanceBeløb;
  const activeClients = ds.clients.filter((c) => c.status === "aktiv" || c.status === "onboarding");
  const directCosts = ds.costs.filter((c) => c.clientId === client.id).reduce((s, c) => s + monthlyAmount(c.beløb, c.frekvens), 0);
  const sharedCosts = ds.costs.filter((c) => c.clientId === null).reduce((s, c) => s + monthlyAmount(c.beløb, c.frekvens), 0);
  const allocatedShared = activeClients.length > 0 ? sharedCosts / activeClients.length : 0;
  const totalCosts = directCosts + allocatedShared;
  const dækningsbidrag = revenue - totalCosts;
  const costPerMeeting = billable > 0 ? totalCosts / billable : null;
  return { revenue, performanceBeløb, directCosts, allocatedShared, totalCosts, dækningsbidrag, billable, costPerMeeting };
}

function monthlyAmount(beløb: number, frekvens: string): number {
  switch (frekvens) {
    case "månedlig": return beløb;
    case "kvartalsvis": return beløb / 3;
    case "årlig": return beløb / 12;
    default: return 0; // engangs — excluded from recurring margin
  }
}

function negativeMarginAlert(client: Client, ds: Dataset, ref: string): Alert | null {
  if (client.status !== "aktiv") return null;
  const eco = clientMonthlyEconomics(client, ds, ref);
  if (eco.dækningsbidrag >= 0) return null;
  return alert({
    id: `negativ-db:${client.id}`,
    niveau: "kritisk",
    kategori: "økonomi",
    titel: `${client.navn} har negativt dækningsbidrag denne måned`,
    konsekvens: `${formatDKK(eco.dækningsbidrag)} i minus, når performance-honorar og omkostninger er talt med — I taber penge på kunden lige nu.`,
    handling: `Gennemgå omkostningerne på ${client.navn} eller genforhandl aftalen.`,
    handlingRoute: `/økonomi?client=${client.id}`,
    entitet: { type: "klient", id: client.id, label: client.navn },
    opstået: `${monthOf(ref)}-01`,
    magnitude: Math.round(Math.abs(eco.dækningsbidrag) / 100),
    detaljer: { dækningsbidrag: eco.dækningsbidrag },
  });
}

// ---------------------------------------------------------------------------
// entry point
// ---------------------------------------------------------------------------

export function computeAllAlerts(ds: Dataset, ref: string = todayISO()): Alert[] {
  const out: Alert[] = [];
  const activeClients = ds.clients.filter((c) => c.status === "aktiv" || c.status === "onboarding");

  for (const client of activeClients) {
    const delivery = deliveryAlertForClient(client, ds, ref);
    if (delivery) out.push(delivery);
    const contract = contractRenewalAlert(client, ds, ref);
    if (contract) out.push(contract);
    const approval = approvalRateAlert(client, ds, ref);
    if (approval) out.push(approval);
    const pending = pendingApprovalAlert(client, ds, ref);
    if (pending) out.push(pending);
    const pattern = rejectionPatternAlert(client, ds, ref);
    if (pattern) out.push(pattern);
    const margin = negativeMarginAlert(client, ds, ref);
    if (margin) out.push(margin);
  }

  // Campaign alerts whose client already has a delivery alert that folded them
  // in (see deliveryAlertForClient) are suppressed here to avoid double-counting
  // the same underlying cause.
  const foldedCampaignIds = new Set(
    out.filter((a) => a.kategori === "levering").flatMap((a) => ds.campaigns.filter((c) => c.clientId === a.entitet.id).map((c) => c.id)),
  );
  for (const campaign of ds.campaigns) {
    if (foldedCampaignIds.has(campaign.id)) continue;
    const drop = campaignReplyRateDrop(campaign, ds, ref);
    if (drop) out.push(drop);
    const silent = campaignNoMeetingsAlert(campaign, ds, ref);
    if (silent) out.push(silent);
    const efficiency = costPerMeetingAlert(campaign, ds, ref);
    if (efficiency) out.push(efficiency);
  }

  out.push(...infrastructureAlerts(ds, ref));
  out.push(...prospectStaleAlerts(ds, ref));
  out.push(...offerFollowupAlerts(ds, ref));
  const lowActivity = lowActivityAlert(ds, ref);
  if (lowActivity) out.push(lowActivity);
  out.push(...overdueInvoiceAlerts(ds, ref));

  return out.sort((a, b) => b.vægt - a.vægt);
}

/** Applies snoozes from alerts_state.json: hides active snoozes, marks the rest. */
export function applyAlertState(alerts: Alert[], ds: Dataset, ref: string = todayISO()): { active: AlertWithState[]; snoozed: AlertWithState[] } {
  const stateById = new Map(ds.alertsState.map((s) => [s.alarmId, s]));
  const active: AlertWithState[] = [];
  const snoozed: AlertWithState[] = [];
  for (const a of alerts) {
    const state = stateById.get(a.id);
    if (state && state.udsatTil >= ref) {
      snoozed.push({ ...a, udsat: true, udsatTil: state.udsatTil, begrundelse: state.begrundelse });
    } else {
      active.push({ ...a, udsat: false });
    }
  }
  return { active, snoozed };
}

export interface RankedAlerts {
  visible: AlertWithState[];
  skjulteAntal: number;
  kritiskAntal: number;
  advarselAntal: number;
}

export function rankAndCap(alerts: AlertWithState[], maksAntalSynlige: number): RankedAlerts {
  const sorted = [...alerts].sort((a, b) => b.vægt - a.vægt);
  return {
    visible: sorted.slice(0, maksAntalSynlige),
    skjulteAntal: Math.max(0, sorted.length - maksAntalSynlige),
    kritiskAntal: sorted.filter((a) => a.niveau === "kritisk").length,
    advarselAntal: sorted.filter((a) => a.niveau === "advarsel").length,
  };
}

export function isLongstanding(a: Alert, settings: Dataset["settings"], ref: string = todayISO()): boolean {
  return daysSince(a.opstået, ref) >= settings.alarmVisning.gammelAlarmDageFørMarkeretSomLangvarig;
}

/** Overall system state — the single line at the top of "I dag". */
export function overallState(active: AlertWithState[]): AlertLevel {
  if (active.some((a) => a.niveau === "kritisk")) return "kritisk";
  if (active.some((a) => a.niveau === "advarsel")) return "advarsel";
  return "sund";
}

export interface SystemCheck {
  label: string;
  status: AlertLevel;
  detalje: string;
}

/**
 * Powers the green-state screen: a real list of what was checked and looked
 * healthy, so "nothing is wrong" reads as the system having looked — not a
 * blank list.
 */
export function systemChecks(ds: Dataset, ref: string = todayISO()): SystemCheck[] {
  const checks: SystemCheck[] = [];
  const activeClients = ds.clients.filter((c) => c.status === "aktiv" || c.status === "onboarding");
  for (const client of activeClients) {
    const monthKey = monthOf(ref);
    const pacing = monthPacing(monthKey, ds.settings, ref);
    const leveret = meetingsCountingTowardQuota(ds.meetings, client.id, monthKey).length;
    const expected = client.aftalteMøderPrMd * pacing.fractionElapsed;
    checks.push({
      label: `Leveringstempo — ${client.navn}`,
      status: leveret >= expected * 0.85 ? "sund" : "advarsel",
      detalje: `${formatNumber(leveret)} af ${formatNumber(client.aftalteMøderPrMd)} møder leveret, på tempo med ${formatPercent(pacing.fractionElapsed)} af måneden gået.`,
    });
  }
  const domains = ds.infrastructure;
  checks.push({
    label: "Afsenderinfrastruktur",
    status: domains.every((d) => d.status === "sund") ? "sund" : "advarsel",
    detalje: `${domains.filter((d) => d.status === "sund").length} af ${domains.length} domæner sunde.`,
  });
  const overdueInvoices = ds.invoices.filter((i) => i.status === "forfalden");
  checks.push({
    label: "Fakturaer",
    status: overdueInvoices.length === 0 ? "sund" : "kritisk",
    detalje: overdueInvoices.length === 0 ? "Ingen forfaldne fakturaer." : `${overdueInvoices.length} forfalden(e) faktura(er).`,
  });
  const staleCount = ds.prospects.filter((p) => p.status !== "vundet" && p.status !== "tabt" && daysSince(p.stadieSkiftetDato, ref) >= ds.settings.alarmTærskler.prospectStilstandDage).length;
  checks.push({
    label: "Eget salg — pipeline-aktivitet",
    status: staleCount === 0 ? "sund" : "advarsel",
    detalje: staleCount === 0 ? "Ingen prospects er gået i stå." : `${staleCount} prospect(s) har stået stille for længe.`,
  });
  return checks;
}
