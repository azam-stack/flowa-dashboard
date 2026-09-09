import express from "express";
import cors from "cors";
import type { ZodTypeAny } from "zod";
import { DATA_DIR, readJsonFile, writeJsonFile, newId, nowIso } from "./store";
import {
  ClientSchema,
  ProspectSchema,
  CampaignSchema,
  OutreachDaySchema,
  MeetingSchema,
  InvoiceSchema,
  InfrastructureSchema,
  CostSchema,
  TaskSchema,
  GoalSchema,
  TeamMemberSchema,
  SettingsSchema,
  EnumsSchema,
  AlertStateEntrySchema,
  ActivityEntrySchema,
  type ActivityEntry,
} from "../src/schema";

const app = express();
app.use(cors());
app.use(express.json());

// ---------------------------------------------------------------------------
// generic array-collection registry
// ---------------------------------------------------------------------------
type Registry = { file: string; schema: ZodTypeAny; idPrefix: string; entitet: string };
const REGISTRY: Record<string, Registry> = {
  clients: { file: "clients.json", schema: ClientSchema, idPrefix: "client", entitet: "kunde" },
  prospects: { file: "prospects.json", schema: ProspectSchema, idPrefix: "prospect", entitet: "prospect" },
  campaigns: { file: "campaigns.json", schema: CampaignSchema, idPrefix: "camp", entitet: "kampagne" },
  outreach: { file: "outreach.json", schema: OutreachDaySchema, idPrefix: "outreach", entitet: "outreach" },
  meetings: { file: "meetings.json", schema: MeetingSchema, idPrefix: "meeting", entitet: "møde" },
  invoices: { file: "invoices.json", schema: InvoiceSchema, idPrefix: "invoice", entitet: "faktura" },
  infrastructure: { file: "infrastructure.json", schema: InfrastructureSchema, idPrefix: "infra", entitet: "infrastruktur" },
  costs: { file: "costs.json", schema: CostSchema, idPrefix: "cost", entitet: "omkostning" },
  tasks: { file: "tasks.json", schema: TaskSchema, idPrefix: "task", entitet: "task" },
  goals: { file: "goals.json", schema: GoalSchema, idPrefix: "goal", entitet: "mål" },
  team: { file: "team.json", schema: TeamMemberSchema, idPrefix: "team", entitet: "teammedlem" },
};

function logActivity(entitet: string, entitetId: string, handling: ActivityEntry["handling"], felter: Record<string, unknown> | undefined, udførtAf: string) {
  const activity = readJsonFile<ActivityEntry[]>("activity.json");
  activity.unshift({
    id: newId("activity"),
    tidspunkt: nowIso(),
    entitet,
    entitetId,
    handling,
    felter,
    udførtAf,
  });
  writeJsonFile("activity.json", activity.slice(0, 2000));
}

function ownerFromBody(body: any): string {
  return typeof body?._udførtAf === "string" && body._udførtAf ? body._udførtAf : "team-azam";
}

// ---------------------------------------------------------------------------
// full dataset (single request, used on app load)
// ---------------------------------------------------------------------------
app.get("/api/data", (_req, res) => {
  try {
    const dataset: Record<string, unknown> = { settings: readJsonFile("settings.json"), enums: readJsonFile("enums.json") };
    for (const [key, reg] of Object.entries(REGISTRY)) dataset[key] = readJsonFile(reg.file);
    dataset.alertsState = readJsonFile("alerts_state.json");
    dataset.activity = readJsonFile("activity.json");
    res.json(dataset);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ---------------------------------------------------------------------------
// settings — single object, PATCH-merge
// ---------------------------------------------------------------------------
app.get("/api/settings", (_req, res) => res.json(readJsonFile("settings.json")));
app.patch("/api/settings", (req, res) => {
  const current = readJsonFile<Record<string, unknown>>("settings.json");
  const merged = deepMerge(current, req.body);
  const parsed = SettingsSchema.safeParse(merged);
  if (!parsed.success) return res.status(400).json({ error: "Ugyldige settings", issues: parsed.error.issues });
  writeJsonFile("settings.json", parsed.data);
  logActivity("settings", "settings", "opdater", req.body, ownerFromBody(req.body));
  res.json(parsed.data);
});

app.get("/api/enums", (_req, res) => {
  const parsed = EnumsSchema.safeParse(readJsonFile("enums.json"));
  if (!parsed.success) return res.status(500).json({ error: "enums.json er ugyldig" });
  res.json(parsed.data);
});

// ---------------------------------------------------------------------------
// alerts_state — keyed by alarmId, upsert-only (snooze / acknowledge)
// ---------------------------------------------------------------------------
app.get("/api/alerts-state", (_req, res) => res.json(readJsonFile("alerts_state.json")));
app.post("/api/alerts-state", (req, res) => {
  const parsed = AlertStateEntrySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Ugyldig alarm-udsættelse", issues: parsed.error.issues });
  const list = readJsonFile<any[]>("alerts_state.json");
  const idx = list.findIndex((e) => e.alarmId === parsed.data.alarmId);
  if (idx >= 0) list[idx] = parsed.data;
  else list.push(parsed.data);
  writeJsonFile("alerts_state.json", list);
  logActivity("alarm", parsed.data.alarmId, idx >= 0 ? "opdater" : "opret", { udsatTil: parsed.data.udsatTil, begrundelse: parsed.data.begrundelse }, parsed.data.udsatAf);
  res.json(parsed.data);
});
app.delete("/api/alerts-state/:alarmId", (req, res) => {
  const list = readJsonFile<any[]>("alerts_state.json");
  const next = list.filter((e) => e.alarmId !== req.params.alarmId);
  writeJsonFile("alerts_state.json", next);
  logActivity("alarm", req.params.alarmId, "slet", undefined, ownerFromBody(req.body));
  res.status(204).end();
});

app.get("/api/activity", (_req, res) => res.json(readJsonFile("activity.json")));

// ---------------------------------------------------------------------------
// generic CRUD for every array collection in REGISTRY
// ---------------------------------------------------------------------------
for (const [route, reg] of Object.entries(REGISTRY)) {
  app.get(`/api/${route}`, (_req, res) => {
    res.json(readJsonFile(reg.file));
  });

  app.post(`/api/${route}`, (req, res) => {
    const list = readJsonFile<any[]>(reg.file);
    const body = { ...req.body };
    delete body._udførtAf;
    if (!body.id) body.id = newId(reg.idPrefix);
    const parsed = reg.schema.safeParse(body);
    if (!parsed.success) return res.status(400).json({ error: `Ugyldig ${reg.entitet}`, issues: parsed.error.issues });
    list.push(parsed.data);
    writeJsonFile(reg.file, list);
    logActivity(reg.entitet, parsed.data.id, "opret", body, ownerFromBody(req.body));
    res.status(201).json(parsed.data);
  });

  app.patch(`/api/${route}/:id`, (req, res) => {
    const list = readJsonFile<any[]>(reg.file);
    const idx = list.findIndex((row) => row.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: `${reg.entitet} ${req.params.id} findes ikke` });
    const patch = { ...req.body };
    delete patch._udførtAf;
    const merged = { ...list[idx], ...patch };
    const parsed = reg.schema.safeParse(merged);
    if (!parsed.success) return res.status(400).json({ error: `Ugyldig ${reg.entitet}`, issues: parsed.error.issues });
    list[idx] = parsed.data;
    writeJsonFile(reg.file, list);
    logActivity(reg.entitet, parsed.data.id, "opdater", patch, ownerFromBody(req.body));
    res.json(parsed.data);
  });

  app.delete(`/api/${route}/:id`, (req, res) => {
    const list = readJsonFile<any[]>(reg.file);
    const next = list.filter((row) => row.id !== req.params.id);
    if (next.length === list.length) return res.status(404).json({ error: `${reg.entitet} ${req.params.id} findes ikke` });
    writeJsonFile(reg.file, next);
    logActivity(reg.entitet, req.params.id, "slet", undefined, ownerFromBody(req.body));
    res.status(204).end();
  });
}

function deepMerge(base: any, patch: any): any {
  if (typeof patch !== "object" || patch === null || Array.isArray(patch)) return patch ?? base;
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    out[k] = typeof v === "object" && v !== null && !Array.isArray(v) ? deepMerge(base?.[k], v) : v;
  }
  return out;
}

app.use((_req, res) => res.status(404).json({ error: "Ukendt route" }));

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(PORT, () => {
  console.log(`Flowa API kører på http://localhost:${PORT}  (data: ${DATA_DIR})`);
});
