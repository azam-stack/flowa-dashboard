import { z } from "zod";

/**
 * Single source of truth for every shape read from /data.
 * Every file is validated on load — a broken JSON file must fail loudly
 * (see lib/loadData.ts) instead of producing a blank screen.
 *
 * INTERNAL FIELDS are marked with an `internal:` doc comment and collected in
 * `INTERNAL_FIELDS` below. When client-facing views are built, strip those
 * keys before anything leaves the server — never expose them by omission.
 */

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Forventede YYYY-MM-DD");
export const isoDateTime = z.string().min(1);

const KanalEnum = z.enum(["email", "telefon"]);
const ProspectKildeEnum = z.enum(["cold_email", "telefon", "linkedin", "netværk", "henvisning"]);
const ProspectStatusEnum = z.enum([
  "ny",
  "kontaktet",
  "svar",
  "møde_booket",
  "møde_afholdt",
  "tilbud_sendt",
  "vundet",
  "tabt",
]);
const TabsårsagEnum = z.enum([
  "pris",
  "timing",
  "valgte_konkurrent",
  "intet_behov",
  "intern_beslutning",
  "ingen_respons",
  "andet",
]);
const ClientStatusEnum = z.enum(["aktiv", "onboarding", "pause", "opsagt"]);
const PerformanceUdløserEnum = z.enum(["booket", "afholdt", "godkendt"]);
const CampaignStatusEnum = z.enum(["planlagt", "aktiv", "pause", "afsluttet"]);
const MeetingStatusEnum = z.enum(["planlagt", "afholdt", "no_show", "aflyst", "flyttet"]);
const GodkendelseEnum = z.enum(["afventer", "godkendt", "afvist"]);
const AfvisningsårsagEnum = z.enum([
  "forkert_icp",
  "ikke_beslutningstager",
  "intet_reelt_behov",
  "dårligt_timet",
  "kunde_dukkede_ikke_op",
]);
const InvoiceStatusEnum = z.enum(["kladde", "sendt", "betalt", "forfalden"]);
const InfraStatusEnum = z.enum(["sund", "advarsel", "brændt"]);
const WarmupStatusEnum = z.enum(["opvarmning", "klar"]);
const CostFrekvensEnum = z.enum(["månedlig", "kvartalsvis", "årlig", "engangs"]);
const CostKategoriEnum = z.enum(["værktøj", "data", "domæner", "løn", "andet"]);
const TaskPrioritetEnum = z.enum(["lav", "mellem", "høj", "kritisk"]);
const TaskStatusEnum = z.enum(["åben", "i_gang", "afsluttet"]);
const GentagelseEnum = z.enum(["daglig", "ugentlig", "månedlig"]).nullable();
const KnyttetTilTypeEnum = z.enum(["klient", "prospect", "møde", "kampagne"]);
const GoalTypeEnum = z.enum(["omsætning", "møder", "kunder", "prospects"]);

// ---------------------------------------------------------------------------
// clients.json
// ---------------------------------------------------------------------------

export const ClientSchema = z.object({
  id: z.string(),
  navn: z.string(),
  kontaktperson: z.string(),
  email: z.string().email(),
  startDato: isoDate,
  kontraktSlut: isoDate.nullable(),
  /** internal: contract notice period in days */
  opsigelsesvarsel: z.number().int().nonnegative(),
  /** internal: financial term */
  retainerBeløb: z.number().nonnegative(),
  /** internal: financial term */
  performanceBeløbPrMøde: z.number().nonnegative(),
  performanceUdløser: PerformanceUdløserEnum,
  aftalteMøderPrMd: z.number().int().positive(),
  icpBeskrivelse: z.string(),
  kanaler: z.array(KanalEnum),
  status: ClientStatusEnum,
  /** internal: our private notes */
  noter: z.string().default(""),
  ownerId: z.string(),
});
export type Client = z.infer<typeof ClientSchema>;
/** Fields never to expose in a future client-facing view. */
export const CLIENT_INTERNAL_FIELDS = ["retainerBeløb", "performanceBeløbPrMøde", "noter", "opsigelsesvarsel"] as const;

// ---------------------------------------------------------------------------
// prospects.json — Flowa's own sales pipeline (entirely internal)
// ---------------------------------------------------------------------------

export const ProspectSchema = z.object({
  id: z.string(),
  virksomhed: z.string(),
  kontaktperson: z.string(),
  rolle: z.string(),
  kilde: ProspectKildeEnum,
  status: ProspectStatusEnum,
  estimeretMånedligVærdi: z.number().nonnegative(),
  næsteHandling: z.string(),
  næsteHandlingDato: isoDate.nullable(),
  tabsårsag: TabsårsagEnum.nullable(),
  noter: z.string().default(""),
  ownerId: z.string(),
  oprettetDato: isoDate,
  /** drives the "stood still X days" staleness alert */
  stadieSkiftetDato: isoDate,
});
export type Prospect = z.infer<typeof ProspectSchema>;

// ---------------------------------------------------------------------------
// campaigns.json
// ---------------------------------------------------------------------------

export const CampaignSchema = z.object({
  id: z.string(),
  clientId: z.string().nullable(),
  navn: z.string(),
  kanal: KanalEnum,
  status: CampaignStatusEnum,
  startDato: isoDate,
  slutDato: isoDate.nullable(),
  målgruppeBeskrivelse: z.string(),
  antalProspectsIListen: z.number().int().nonnegative(),
  ownerId: z.string(),
});
export type Campaign = z.infer<typeof CampaignSchema>;

// ---------------------------------------------------------------------------
// outreach.json — daily aggregate per campaign, email and phone never mixed
// ---------------------------------------------------------------------------

export const OutreachDaySchema = z.object({
  id: z.string(),
  dato: isoDate,
  campaignId: z.string(),
  emailsSendt: z.number().int().nonnegative().default(0),
  bounces: z.number().int().nonnegative().default(0),
  svar: z.number().int().nonnegative().default(0),
  positiveSvar: z.number().int().nonnegative().default(0),
  afmeldinger: z.number().int().nonnegative().default(0),
  opkaldForsøgt: z.number().int().nonnegative().default(0),
  connects: z.number().int().nonnegative().default(0),
  samtaler: z.number().int().nonnegative().default(0),
  møderSat: z.number().int().nonnegative().default(0),
});
export type OutreachDay = z.infer<typeof OutreachDaySchema>;

// ---------------------------------------------------------------------------
// meetings.json
// ---------------------------------------------------------------------------

export const MeetingSchema = z.object({
  id: z.string(),
  clientId: z.string().nullable(),
  prospectNavn: z.string(),
  virksomhed: z.string(),
  rolle: z.string(),
  campaignId: z.string().nullable(),
  booketDato: isoDate,
  mødeDato: isoDate,
  kanal: KanalEnum,
  status: MeetingStatusEnum,
  godkendelse: GodkendelseEnum,
  afvisningsårsag: AfvisningsårsagEnum.nullable(),
  /** internal: billing eligibility */
  faktureres: z.boolean(),
  noter: z.string().default(""),
  ownerId: z.string(),
  /** last time `godkendelse` changed — drives the pending-too-long alert */
  godkendelseOpdateretDato: isoDate,
});
export type Meeting = z.infer<typeof MeetingSchema>;
export const MEETING_INTERNAL_FIELDS = ["faktureres", "noter"] as const;

// ---------------------------------------------------------------------------
// invoices.json
// ---------------------------------------------------------------------------

export const InvoiceSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  måned: z.string().regex(/^\d{4}-\d{2}$/),
  retainerBeløb: z.number().nonnegative(),
  antalFaktureredeMøder: z.number().int().nonnegative(),
  performanceBeløb: z.number().nonnegative(),
  total: z.number().nonnegative(),
  status: InvoiceStatusEnum,
  forfaldsdato: isoDate,
});
export type Invoice = z.infer<typeof InvoiceSchema>;

// ---------------------------------------------------------------------------
// infrastructure.json (entirely internal)
// ---------------------------------------------------------------------------

export const InfrastructureSchema = z.object({
  id: z.string(),
  domæne: z.string(),
  antalIndbakker: z.number().int().nonnegative(),
  warmupStatus: WarmupStatusEnum,
  dagligSendekapacitet: z.number().int().nonnegative(),
  bounceRate7d: z.number().nonnegative(),
  spamklager: z.number().int().nonnegative(),
  status: InfraStatusEnum,
  oprettet: isoDate,
  noter: z.string().default(""),
});
export type Infrastructure = z.infer<typeof InfrastructureSchema>;

// ---------------------------------------------------------------------------
// costs.json (entirely internal)
// ---------------------------------------------------------------------------

export const CostSchema = z.object({
  id: z.string(),
  navn: z.string(),
  beløb: z.number().nonnegative(),
  frekvens: CostFrekvensEnum,
  kategori: CostKategoriEnum,
  clientId: z.string().nullable(),
});
export type Cost = z.infer<typeof CostSchema>;

// ---------------------------------------------------------------------------
// tasks.json
// ---------------------------------------------------------------------------

export const TaskLinkSchema = z.object({ type: KnyttetTilTypeEnum, id: z.string() }).nullable();

export const TaskSchema = z.object({
  id: z.string(),
  titel: z.string(),
  beskrivelse: z.string().default(""),
  forfaldsdato: isoDate,
  prioritet: TaskPrioritetEnum,
  status: TaskStatusEnum,
  knyttetTil: TaskLinkSchema,
  gentagelse: GentagelseEnum,
  ownerId: z.string(),
  oprettetDato: isoDate,
});
export type FlowaTask = z.infer<typeof TaskSchema>;

// ---------------------------------------------------------------------------
// goals.json
// ---------------------------------------------------------------------------

export const GoalSchema = z.object({
  id: z.string(),
  navn: z.string(),
  type: GoalTypeEnum,
  målværdi: z.number().nonnegative(),
  periode: z.string(),
  periodeStart: isoDate,
  periodeSlut: isoDate,
});
export type Goal = z.infer<typeof GoalSchema>;

// ---------------------------------------------------------------------------
// team.json
// ---------------------------------------------------------------------------

export const TeamMemberSchema = z.object({
  id: z.string(),
  navn: z.string(),
  initialer: z.string(),
  rolle: z.string(),
  farve: z.string(),
  aktiv: z.boolean(),
});
export type TeamMember = z.infer<typeof TeamMemberSchema>;

// ---------------------------------------------------------------------------
// alerts_state.json — snoozes/acknowledgements only; alerts are computed
// ---------------------------------------------------------------------------

export const AlertStateEntrySchema = z.object({
  alarmId: z.string(),
  udsatTil: isoDate,
  begrundelse: z.string(),
  udsatAf: z.string(),
  tidspunkt: isoDateTime,
});
export type AlertStateEntry = z.infer<typeof AlertStateEntrySchema>;

// ---------------------------------------------------------------------------
// activity.json — server-written mutation log
// ---------------------------------------------------------------------------

export const ActivityEntrySchema = z.object({
  id: z.string(),
  tidspunkt: isoDateTime,
  entitet: z.string(),
  entitetId: z.string(),
  handling: z.enum(["opret", "opdater", "slet"]),
  felter: z.record(z.unknown()).optional(),
  udførtAf: z.string(),
});
export type ActivityEntry = z.infer<typeof ActivityEntrySchema>;

// ---------------------------------------------------------------------------
// settings.json
// ---------------------------------------------------------------------------

export const SettingsSchema = z.object({
  valuta: z.string(),
  tidszone: z.string(),
  arbejdsdage: z.array(z.number().int().min(0).max(6)),
  helligdage: z.array(isoDate),
  regnskabsårStartMåned: z.number().int().min(1).max(12),
  standardMål: z.object({
    nyeKunderPrKvartal: z.number(),
    aktiveProspectsMål: z.number(),
  }),
  alarmTærskler: z.object({
    prospectStilstandDage: z.number(),
    tilbudOpfølgningDage: z.number(),
    kundeIngenLeveringDage: z.number(),
    opsigelsesvarselAdvarselDage: z.number(),
    godkendelsesrateAdvarselProcent: z.number(),
    godkendelsesrateKritiskProcent: z.number(),
    godkendelseAfventerAdvarselDage: z.number(),
    godkendelseAfventerKritiskDage: z.number(),
    afvisningsårsagStigningProcent: z.number(),
    positivSvarrateFaldProcent: z.number(),
    kampagneIngenMøderDage: z.number(),
    mailsPrMødeForværringProcent: z.number(),
    bounceRateAdvarselProcent: z.number(),
    bounceRateKritiskProcent: z.number(),
    kapacitetKritiskProcent: z.number(),
    fakturaForfaldenDage: z.number(),
    egetSalgLavAktivitetSamtalerPrUge: z.number(),
  }),
  healthScore: z.object({
    kritiskUnder: z.number(),
    advarselUnder: z.number(),
    vægte: z.object({
      leveringsgrad: z.number(),
      godkendelsesrate: z.number(),
      dageSidenLeveretMøde: z.number(),
    }),
  }),
  alarmVisning: z.object({
    maksAntalSynlige: z.number(),
    gammelAlarmDageFørMarkeretSomLangvarig: z.number(),
  }),
  kommandopalette: z.object({ genvej: z.string() }),
});
export type Settings = z.infer<typeof SettingsSchema>;

// ---------------------------------------------------------------------------
// enums.json
// ---------------------------------------------------------------------------

export const EnumOptionSchema = z.object({ key: z.string(), label: z.string() });
export const EnumsSchema = z.record(z.array(EnumOptionSchema));
export type Enums = z.infer<typeof EnumsSchema>;

// ---------------------------------------------------------------------------
// The whole dataset, as loaded by the client and the server
// ---------------------------------------------------------------------------

export const DatasetSchema = z.object({
  clients: z.array(ClientSchema),
  prospects: z.array(ProspectSchema),
  campaigns: z.array(CampaignSchema),
  outreach: z.array(OutreachDaySchema),
  meetings: z.array(MeetingSchema),
  invoices: z.array(InvoiceSchema),
  infrastructure: z.array(InfrastructureSchema),
  costs: z.array(CostSchema),
  tasks: z.array(TaskSchema),
  goals: z.array(GoalSchema),
  settings: SettingsSchema,
  enums: EnumsSchema,
  team: z.array(TeamMemberSchema),
  alertsState: z.array(AlertStateEntrySchema),
  activity: z.array(ActivityEntrySchema),
});
export type Dataset = z.infer<typeof DatasetSchema>;

export const COLLECTION_FILES: Record<keyof Omit<Dataset, "settings" | "enums">, string> = {
  clients: "clients.json",
  prospects: "prospects.json",
  campaigns: "campaigns.json",
  outreach: "outreach.json",
  meetings: "meetings.json",
  invoices: "invoices.json",
  infrastructure: "infrastructure.json",
  costs: "costs.json",
  tasks: "tasks.json",
  goals: "goals.json",
  team: "team.json",
  alertsState: "alerts_state.json",
  activity: "activity.json",
};
