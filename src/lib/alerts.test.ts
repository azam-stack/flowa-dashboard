import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DatasetSchema, type Dataset } from "@/schema";
import {
  computeAllAlerts,
  applyAlertState,
  rankAndCap,
  clientHealthScore,
  clientMonthlyEconomics,
  systemChecks,
  overallState,
} from "./alerts";

function loadDataset(): Dataset {
  const dir = join(__dirname, "..", "..", "data");
  const read = (f: string) => JSON.parse(readFileSync(join(dir, f), "utf-8"));
  const raw = {
    clients: read("clients.json"),
    prospects: read("prospects.json"),
    campaigns: read("campaigns.json"),
    outreach: read("outreach.json"),
    meetings: read("meetings.json"),
    invoices: read("invoices.json"),
    infrastructure: read("infrastructure.json"),
    costs: read("costs.json"),
    tasks: read("tasks.json"),
    goals: read("goals.json"),
    settings: read("settings.json"),
    enums: read("enums.json"),
    team: read("team.json"),
    alertsState: read("alerts_state.json"),
    activity: read("activity.json"),
  };
  return DatasetSchema.parse(raw);
}

describe("alert engine — full demo dataset", () => {
  const ds = loadDataset();
  const alerts = computeAllAlerts(ds);

  it("flags Kolding Metal as behind on quota", () => {
    const a = alerts.find((x) => x.id === "levering-bagud:client-koldingmetal");
    expect(a).toBeTruthy();
    expect(["kritisk", "advarsel"]).toContain(a!.niveau);
    expect(a!.konsekvens).toMatch(/mangler/i);
  });

  it("does not flag Nordic Gears as behind on quota", () => {
    const a = alerts.find((x) => x.id === "levering-bagud:client-nordicgears");
    expect(a).toBeFalsy();
  });

  it("flags Kolding Metal's low approval rate", () => {
    const a = alerts.find((x) => x.id === "godkendelsesrate:client-koldingmetal");
    expect(a).toBeTruthy();
  });

  it("flags meetings pending approval too long, with unbilled amount", () => {
    const a = alerts.find((x) => x.id.startsWith("godkendelse-afventer:"));
    expect(a).toBeTruthy();
    expect(a!.detaljer?.beløb).toBeGreaterThan(0);
  });

  it("flags the overdue invoice", () => {
    const a = alerts.find((x) => x.id.startsWith("faktura-forfalden:"));
    expect(a).toBeTruthy();
    expect(a!.niveau).toBeDefined();
  });

  it("flags the burned domain as critical", () => {
    const a = alerts.find((x) => x.id.includes("infra-brændt"));
    expect(a).toBeTruthy();
    expect(a!.niveau).toBe("kritisk");
  });

  it("flags stale prospects individually with a named contact", () => {
    const stale = alerts.filter((x) => x.id.startsWith("prospect-stille:"));
    expect(stale.length).toBeGreaterThan(0);
    expect(stale[0].titel).toMatch(/Ring til/);
  });

  it("sorts critical alerts before advarsel", () => {
    const levels = alerts.map((a) => a.niveau);
    const firstAdvarsel = levels.indexOf("advarsel");
    const lastKritisk = levels.lastIndexOf("kritisk");
    if (firstAdvarsel !== -1 && lastKritisk !== -1) {
      expect(lastKritisk).toBeLessThan(firstAdvarsel);
    }
  });

  it("computes a lower health score for Kolding Metal than Nordic Gears", () => {
    const a = clientHealthScore(ds.clients.find((c) => c.id === "client-nordicgears")!, ds);
    const b = clientHealthScore(ds.clients.find((c) => c.id === "client-koldingmetal")!, ds);
    expect(b.score).toBeLessThan(a.score);
  });

  it("computes client economics without throwing and returns a number", () => {
    const eco = clientMonthlyEconomics(ds.clients[0], ds);
    expect(typeof eco.dækningsbidrag).toBe("number");
  });

  it("caps visible alerts at settings.alarmVisning.maksAntalSynlige and reports the rest as hidden", () => {
    const { active } = applyAlertState(alerts, ds);
    const ranked = rankAndCap(active, ds.settings.alarmVisning.maksAntalSynlige);
    expect(ranked.visible.length).toBeLessThanOrEqual(ds.settings.alarmVisning.maksAntalSynlige);
    expect(ranked.skjulteAntal).toBe(Math.max(0, active.length - ds.settings.alarmVisning.maksAntalSynlige));
  });

  it("honors an active snooze by excluding it from active alerts", () => {
    const { active } = applyAlertState(alerts, ds);
    const target = active[0];
    const dsWithSnooze: Dataset = {
      ...ds,
      alertsState: [
        ...ds.alertsState,
        { alarmId: target.id, udsatTil: "2099-01-01", begrundelse: "test", udsatAf: "team-azam", tidspunkt: new Date().toISOString() },
      ],
    };
    const result = applyAlertState(alerts, dsWithSnooze);
    expect(result.active.find((a) => a.id === target.id)).toBeFalsy();
    expect(result.snoozed.find((a) => a.id === target.id)).toBeTruthy();
  });

  it("overallState is kritisk when any active alert is kritisk", () => {
    const { active } = applyAlertState(alerts, ds);
    expect(overallState(active)).toBe(active.some((a) => a.niveau === "kritisk") ? "kritisk" : overallState(active));
  });

  it("systemChecks returns entries even when everything is healthy-ish", () => {
    const checks = systemChecks(ds);
    expect(checks.length).toBeGreaterThan(0);
    for (const c of checks) {
      expect(["sund", "advarsel", "kritisk"]).toContain(c.status);
    }
  });

  it("every alert id is unique (no accidental duplicate causes)", () => {
    const ids = alerts.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("alert engine — empty (zero-client) dataset shape", () => {
  it("produces no delivery/economy alerts when there are no clients", () => {
    const ds = loadDataset();
    const emptyDs: Dataset = { ...ds, clients: [], meetings: [], invoices: [] };
    const alerts = computeAllAlerts(emptyDs);
    expect(alerts.every((a) => a.kategori !== "levering")).toBe(true);
    expect(alerts.every((a) => a.kategori !== "godkendelse")).toBe(true);
  });
});
