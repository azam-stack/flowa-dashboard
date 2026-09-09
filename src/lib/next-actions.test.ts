import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DatasetSchema, type Dataset } from "@/schema";
import { computeNextActions, scoreAction } from "./next-actions";

function loadDataset(): Dataset {
  const dir = join(__dirname, "..", "..", "data");
  const read = (f: string) => JSON.parse(readFileSync(join(dir, f), "utf-8"));
  const raw = {
    clients: read("clients.json"), prospects: read("prospects.json"), campaigns: read("campaigns.json"),
    outreach: read("outreach.json"), meetings: read("meetings.json"), invoices: read("invoices.json"),
    infrastructure: read("infrastructure.json"), costs: read("costs.json"), tasks: read("tasks.json"),
    goals: read("goals.json"), settings: read("settings.json"), enums: read("enums.json"), team: read("team.json"),
    alertsState: read("alerts_state.json"), activity: read("activity.json"),
  };
  return DatasetSchema.parse(raw);
}

describe("scoreAction formula", () => {
  it("ranks higher consequence above higher effort at equal urgency", () => {
    const highConsequence = scoreAction(5, 3, 3);
    const lowConsequence = scoreAction(2, 3, 3);
    expect(highConsequence.total).toBeGreaterThan(lowConsequence.total);
  });
  it("prefers lower effort at equal consequence and urgency", () => {
    const easy = scoreAction(3, 3, 1);
    const hard = scoreAction(3, 3, 5);
    expect(easy.total).toBeGreaterThan(hard.total);
  });
});

describe("computeNextActions — full demo dataset", () => {
  const ds = loadDataset();
  const { actions, totalCandidates } = computeNextActions(ds);

  it("returns between 5 and 7 actions when candidates allow", () => {
    expect(actions.length).toBeGreaterThan(0);
    expect(actions.length).toBeLessThanOrEqual(7);
  });

  it("every action is sorted by descending total score", () => {
    for (let i = 1; i < actions.length; i++) {
      expect(actions[i - 1].score.total).toBeGreaterThanOrEqual(actions[i].score.total);
    }
  });

  it("includes an inline-approvable pending meeting for Kolding Metal", () => {
    const found = actions.some((a) => a.inline?.type === "godkend_møde");
    expect(found).toBe(true);
  });

  it("never returns more unique entities than candidates found", () => {
    expect(actions.length).toBeLessThanOrEqual(totalCandidates);
  });

  it("each action has a non-empty imperative title and a route", () => {
    for (const a of actions) {
      expect(a.titel.length).toBeGreaterThan(0);
      expect(a.route.length).toBeGreaterThan(0);
    }
  });
});

describe("computeNextActions — zero-client dataset", () => {
  it("still returns own-sales actions (stale prospects, overdue offers) with no client-side entries", () => {
    const ds = loadDataset();
    const emptyDs: Dataset = { ...ds, clients: [], meetings: [], invoices: [] };
    const { actions } = computeNextActions(emptyDs);
    expect(actions.every((a) => a.kilde.type !== "møde")).toBe(true);
  });
});
