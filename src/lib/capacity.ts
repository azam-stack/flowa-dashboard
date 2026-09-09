import type { Dataset } from "@/schema";
import { daysSince, todayISO } from "./dates";

export interface CapacitySummary {
  healthyEmailCapacity: number;
  requiredEmailDaily: number;
  emailUtilization: number;
  avgEmailPerActiveClient: number;
  extraEmailClientSlots: number;
  avgPhonePerActiveClient: number;
  phoneUtilizationNote: string;
  activeClientCount: number;
}

/**
 * How many more clients the current sender infrastructure and phone
 * throughput can realistically support, based on what active clients are
 * actually using today (not a theoretical max).
 */
export function computeCapacitySummary(ds: Dataset, ref: string = todayISO()): CapacitySummary {
  const healthyEmailCapacity = ds.infrastructure.filter((d) => d.status !== "brændt").reduce((s, d) => s + d.dagligSendekapacitet, 0);
  const activeClients = ds.clients.filter((c) => c.status === "aktiv" || c.status === "onboarding");
  const activeEmailCampaigns = ds.campaigns.filter((c) => c.kanal === "email" && c.status === "aktiv");
  const activePhoneCampaigns = ds.campaigns.filter((c) => c.kanal === "telefon" && c.status === "aktiv");

  const avgDaily = (campaignIds: string[], field: "emailsSendt" | "opkaldForsøgt") => {
    const rows = ds.outreach.filter((o) => campaignIds.includes(o.campaignId) && daysSince(o.dato, ref) <= 14 && daysSince(o.dato, ref) >= 0);
    if (rows.length === 0) return 0;
    return rows.reduce((s, r) => s + r[field], 0) / rows.length;
  };

  const requiredEmailDaily = avgDaily(activeEmailCampaigns.map((c) => c.id), "emailsSendt");
  const emailUtilization = healthyEmailCapacity > 0 ? requiredEmailDaily / healthyEmailCapacity : 0;

  const clientEmailCampaigns = activeEmailCampaigns.filter((c) => c.clientId !== null);
  const avgEmailPerActiveClient =
    clientEmailCampaigns.length > 0
      ? clientEmailCampaigns.reduce((s, c) => s + avgDaily([c.id], "emailsSendt"), 0) / clientEmailCampaigns.length
      : requiredEmailDaily > 0
        ? requiredEmailDaily
        : 60; // sane fallback for a zero-client, zero-history state

  const headroom = Math.max(0, healthyEmailCapacity - requiredEmailDaily);
  const extraEmailClientSlots = avgEmailPerActiveClient > 0 ? Math.floor(headroom / avgEmailPerActiveClient) : 0;

  const clientPhoneCampaigns = activePhoneCampaigns.filter((c) => c.clientId !== null);
  const avgPhonePerActiveClient = clientPhoneCampaigns.length > 0 ? clientPhoneCampaigns.reduce((s, c) => s + avgDaily([c.id], "opkaldForsøgt"), 0) / clientPhoneCampaigns.length : 0;

  return {
    healthyEmailCapacity,
    requiredEmailDaily: Math.round(requiredEmailDaily),
    emailUtilization,
    avgEmailPerActiveClient: Math.round(avgEmailPerActiveClient),
    extraEmailClientSlots,
    avgPhonePerActiveClient: Math.round(avgPhonePerActiveClient),
    phoneUtilizationNote:
      clientPhoneCampaigns.length > 0
        ? `Hver aktiv kunde bruger i snit ${Math.round(avgPhonePerActiveClient)} opkaldsforsøg/dag på den nuværende telefonkapacitet.`
        : "Ingen kundedrevne telefonkampagner endnu — telefonkapacitet er ikke presset.",
    activeClientCount: activeClients.length,
  };
}
