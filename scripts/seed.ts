/**
 * Generates every file in /data.
 *
 * `npm run seed:full`  -> realistic dataset: our own pipeline + 2 clients with
 *                         3-4 months of delivery history (one healthy, one
 *                         behind quota with a rejection-rate problem), so
 *                         every module and every alert rule can be seen working.
 * `npm run seed:empty` -> our actual day-one state: zero clients, a small
 *                         real starter pipeline, no delivery data at all.
 */
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import settings from "../data/settings.json" with { type: "json" };
import enums from "../data/enums.json" with { type: "json" };

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");

// ---------------------------------------------------------------------------
// deterministic RNG so the seed is reproducible
// ---------------------------------------------------------------------------
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260909);
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
const chance = (p: number) => rand() < p;
let idCounter = 0;
const id = (prefix: string) => `${prefix}-${(++idCounter).toString(36)}`;

// ---------------------------------------------------------------------------
// date helpers
// ---------------------------------------------------------------------------
const TODAY = new Date(); // real "now" — the dataset is anchored to it
const HOLIDAYS = new Set<string>(settings.helligdage);

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function isWorkday(d: Date): boolean {
  const day = d.getDay();
  if (day === 0 || day === 6) return false;
  if (HOLIDAYS.has(fmt(d))) return false;
  return true;
}
function workdaysBetween(from: Date, to: Date): string[] {
  const out: string[] = [];
  let cur = new Date(from);
  while (cur <= to) {
    if (isWorkday(cur)) out.push(fmt(cur));
    cur = addDays(cur, 1);
  }
  return out;
}
const N_DAYS_BACK = 100;
const WINDOW_START = addDays(TODAY, -N_DAYS_BACK);
const ALL_WORKDAYS = workdaysBetween(WINDOW_START, TODAY);

// ---------------------------------------------------------------------------
// static reference data
// ---------------------------------------------------------------------------
const OWNER = "team-azam";

const team = [
  { id: OWNER, navn: "Azam", initialer: "AZ", rolle: "Founder", farve: "#EE9E47", aktiv: true },
];

// ===========================================================================
// PROSPECT POOL (Flowa's own sales pipeline)
// ===========================================================================
const COMPANY_POOL = [
  "Nordwind Consulting", "Kolding Logistik A/S", "Baltic Freight Solutions", "Vestergaard Byg",
  "Hansen Maskinfabrik", "Danisco Partners", "Aalborg Software House", "Kystvind Energi",
  "Nordisk Emballage", "Skanderborg IT-Drift", "Frederiksen Stål", "Copenhagen Cloud Services",
  "Elmehøj Rådgivning", "Jysk Facility Group", "Herning Industriservice", "Blue Harbor Shipping",
  "Nykredit Erhvervspartner", "Randers Robotics", "Aarhus Data Solutions", "Fjordland Fødevarer",
  "Vindmølle Vedligehold ApS", "Trekantens Transport", "Sønderjysk Solenergi", "Horsens HR-Systemer",
  "Grøn Logistikpartner", "Silkeborg SaaS Studio", "Odense Automation", "Nordjysk Netværk & IT",
  "Esbjerg Offshore Support", "Midtjysk Møbelproduktion",
];
const ROLE_POOL = ["CEO", "Salgsdirektør", "CFO", "COO", "Head of Growth", "Marketingchef", "Partner", "Ejer"];
const CONTACT_FIRST = ["Martin", "Sofie", "Anders", "Line", "Peter", "Mette", "Thomas", "Camilla", "Jonas", "Ida", "Rasmus", "Freja", "Nikolaj", "Louise", "Kasper"];
const CONTACT_LAST = ["Jensen", "Nielsen", "Poulsen", "Andersen", "Christensen", "Larsen", "Sørensen", "Madsen", "Berg", "Holm"];
const contactName = () => `${pick(CONTACT_FIRST)} ${pick(CONTACT_LAST)}`;

const KILDER = ["cold_email", "telefon", "linkedin", "netværk", "henvisning"] as const;
const TABSAARSAGER = ["pris", "timing", "valgte_konkurrent", "intet_behov", "intern_beslutning", "ingen_respons", "andet"] as const;

const PROSPECT_STATUS_PLAN: Array<{ status: string; count: number }> = [
  { status: "ny", count: 7 },
  { status: "kontaktet", count: 7 },
  { status: "svar", count: 4 },
  { status: "møde_booket", count: 3 },
  { status: "møde_afholdt", count: 3 },
  { status: "tilbud_sendt", count: 3 },
  { status: "vundet", count: 1 }, // matches "we're landing our first client" — the deal in flight
  { status: "tabt", count: 3 },
];

function buildProspects() {
  const companies = [...COMPANY_POOL];
  const prospects = [];
  let companyIdx = 0;
  for (const { status, count } of PROSPECT_STATUS_PLAN) {
    for (let i = 0; i < count; i++) {
      const virksomhed = companies[companyIdx++ % companies.length];
      const kilde = pick(KILDER);
      const createdDaysAgo = int(3, 95);
      const oprettetDato = fmt(addDays(TODAY, -createdDaysAgo));

      // staleness varies deliberately: a handful sit untouched past the threshold
      let stageAgeDays: number;
      if (status === "vundet" || status === "tabt") {
        stageAgeDays = int(1, Math.min(createdDaysAgo, 40));
      } else if (i === 0 && (status === "kontaktet" || status === "svar" || status === "tilbud_sendt")) {
        stageAgeDays = int(11, 21); // deliberately stale — feeds the alert engine
      } else {
        stageAgeDays = int(0, 9);
      }
      const stadieSkiftetDato = fmt(addDays(TODAY, -Math.min(stageAgeDays, createdDaysAgo)));

      let næsteHandling = "";
      let næsteHandlingDato: string | null = null;
      const tabsårsag = status === "tabt" ? pick(TABSAARSAGER) : null;

      switch (status) {
        case "ny":
          næsteHandling = "Første kontakt";
          næsteHandlingDato = fmt(addDays(TODAY, int(0, 4)));
          break;
        case "kontaktet":
          næsteHandling = "Følg op på første besked";
          næsteHandlingDato = fmt(addDays(TODAY, int(-3, 3)));
          break;
        case "svar":
          næsteHandling = "Book møde";
          næsteHandlingDato = fmt(addDays(TODAY, int(-1, 4)));
          break;
        case "møde_booket":
          næsteHandling = "Forbered og afhold møde";
          næsteHandlingDato = fmt(addDays(TODAY, int(1, 7)));
          break;
        case "møde_afholdt":
          næsteHandling = "Send tilbud";
          næsteHandlingDato = fmt(addDays(TODAY, int(-2, 3)));
          break;
        case "tilbud_sendt":
          næsteHandling = "Følg op på tilbud";
          næsteHandlingDato = fmt(addDays(TODAY, int(-6, 1)));
          break;
        case "vundet":
          næsteHandling = "Onboard som kunde";
          næsteHandlingDato = null;
          break;
        case "tabt":
          næsteHandling = "";
          næsteHandlingDato = null;
          break;
      }

      prospects.push({
        id: id("prospect"),
        virksomhed,
        kontaktperson: contactName(),
        rolle: pick(ROLE_POOL),
        kilde,
        status,
        estimeretMånedligVærdi: int(12, 40) * 1000,
        næsteHandling,
        næsteHandlingDato,
        tabsårsag,
        noter: "",
        ownerId: OWNER,
        oprettetDato,
        stadieSkiftetDato,
      });
    }
  }
  return prospects;
}

// ===========================================================================
// CLIENTS
// ===========================================================================
function buildClients() {
  const clientA = {
    id: "client-nordicgears",
    navn: "Nordic Gears ApS",
    kontaktperson: "Signe Lund",
    email: "signe@nordicgears.dk",
    startDato: fmt(addDays(TODAY, -132)), // ~4.5 months ago
    kontraktSlut: fmt(addDays(TODAY, 233)),
    opsigelsesvarsel: 30,
    retainerBeløb: 25000,
    performanceBeløbPrMøde: 1200,
    performanceUdløser: "afholdt" as const,
    aftalteMøderPrMd: 12,
    icpBeskrivelse: "B2B SaaS-virksomheder, 50-500 ansatte, IT- og driftsansvarlige som beslutningstagere",
    kanaler: ["email", "telefon"] as const,
    status: "aktiv" as const,
    noter: "Sund kunde. Hurtig godkendelse, tæt dialog. God reference-case.",
    ownerId: OWNER,
  };
  const clientB = {
    id: "client-koldingmetal",
    navn: "Kolding Metal & Montage A/S",
    kontaktperson: "Henrik Boysen",
    email: "hb@koldingmetal.dk",
    startDato: fmt(addDays(TODAY, -101)), // ~3.3 months ago
    kontraktSlut: fmt(addDays(TODAY, 47)), // contract renewal approaching — see notice-period alert
    opsigelsesvarsel: 30,
    retainerBeløb: 20000,
    performanceBeløbPrMøde: 1000,
    performanceUdløser: "godkendt" as const,
    aftalteMøderPrMd: 10,
    icpBeskrivelse: "Produktionsvirksomheder 20-200 ansatte i Trekantområdet, driftschef eller indkøbschef",
    kanaler: ["email", "telefon"] as const,
    status: "aktiv" as const,
    noter: "Bagud på kvote i september. Høj afvisningsrate på ICP-match — kampagnen rammer for bredt. Kontrakt op til fornyelse om ~7 uger; skal vendes før den dato.",
    ownerId: OWNER,
  };
  return [clientA, clientB];
}

// ===========================================================================
// CAMPAIGNS
// ===========================================================================
function buildCampaigns(clients: ReturnType<typeof buildClients>) {
  return [
    { id: "camp-own-email", clientId: null, navn: "Flowa – eget salg (email)", kanal: "email" as const, status: "aktiv" as const, startDato: fmt(addDays(TODAY, -95)), slutDato: null, målgruppeBeskrivelse: "Bureau-ejere og salgschefer i danske B2B-virksomheder 20-300 ansatte", antalProspectsIListen: 640, ownerId: OWNER },
    { id: "camp-own-phone", clientId: null, navn: "Flowa – eget salg (telefon)", kanal: "telefon" as const, status: "aktiv" as const, startDato: fmt(addDays(TODAY, -95)), slutDato: null, målgruppeBeskrivelse: "Varme leads og henvisninger", antalProspectsIListen: 180, ownerId: OWNER },
    { id: "camp-nordicgears-email", clientId: clients[0].id, navn: "Nordic Gears — IT-beslutningstagere", kanal: "email" as const, status: "aktiv" as const, startDato: fmt(addDays(TODAY, -130)), slutDato: null, målgruppeBeskrivelse: "IT- og driftsansvarlige i SaaS-virksomheder 50-500 ansatte", antalProspectsIListen: 1450, ownerId: OWNER },
    { id: "camp-nordicgears-phone", clientId: clients[0].id, navn: "Nordic Gears — opfølgningsopkald", kanal: "telefon" as const, status: "aktiv" as const, startDato: fmt(addDays(TODAY, -120)), slutDato: null, målgruppeBeskrivelse: "Varme leads fra email-kampagnen", antalProspectsIListen: 310, ownerId: OWNER },
    { id: "camp-koldingmetal-email", clientId: clients[1].id, navn: "Kolding Metal — driftschefer Trekanten", kanal: "email" as const, status: "aktiv" as const, startDato: fmt(addDays(TODAY, -99)), slutDato: null, målgruppeBeskrivelse: "Driftschefer/indkøbschefer, produktion 20-200 ansatte", antalProspectsIListen: 980, ownerId: OWNER },
    { id: "camp-koldingmetal-phone", clientId: clients[1].id, navn: "Kolding Metal — telefonopfølgning", kanal: "telefon" as const, status: "aktiv" as const, startDato: fmt(addDays(TODAY, -90)), slutDato: null, målgruppeBeskrivelse: "Opfølgning på ubesvarede emails", antalProspectsIListen: 220, ownerId: OWNER },
  ];
}

// ===========================================================================
// OUTREACH — daily aggregate per campaign, workdays only
// ===========================================================================
function buildOutreach(campaigns: ReturnType<typeof buildCampaigns>) {
  const rows: any[] = [];
  for (const camp of campaigns) {
    const campWorkdays = ALL_WORKDAYS.filter((d) => d >= camp.startDato);
    const isKoldingEmail = camp.id === "camp-koldingmetal-email";
    campWorkdays.forEach((dato, idx) => {
      const daysAgo = Math.round((TODAY.getTime() - new Date(dato).getTime()) / 86400000);
      const inDeclineWindow = isKoldingEmail && daysAgo <= 14; // deliberate drop in the last 2 weeks

      if (camp.kanal === "email") {
        const emailsSendt = int(35, 70);
        const bounces = Math.round(emailsSendt * (camp.id === "camp-koldingmetal-email" ? int(3, 6) / 100 : int(1, 3) / 100));
        const svar = int(1, 6);
        let positiveRate = camp.id === "camp-own-email" ? int(5, 9) : int(7, 12);
        if (inDeclineWindow) positiveRate = int(3, 5); // ~28% relative drop, feeds the campaign-decline alert
        const positiveSvar = Math.min(svar, Math.round((emailsSendt * positiveRate) / 100 / 3));
        const afmeldinger = chance(0.15) ? 1 : 0;
        const møderSat = chance(camp.id === "camp-koldingmetal-email" ? 0.1 : 0.16) ? 1 : 0;
        rows.push({
          id: id("outreach"), dato, campaignId: camp.id,
          emailsSendt, bounces, svar, positiveSvar, afmeldinger,
          opkaldForsøgt: 0, connects: 0, samtaler: 0, møderSat,
        });
      } else {
        const opkaldForsøgt = int(15, 35);
        const connects = Math.round(opkaldForsøgt * (int(20, 35) / 100));
        const samtaler = Math.round(connects * (int(30, 55) / 100));
        const møderSat = chance(0.22) ? int(1, 2) : 0;
        rows.push({
          id: id("outreach"), dato, campaignId: camp.id,
          emailsSendt: 0, bounces: 0, svar: 0, positiveSvar: 0, afmeldinger: 0,
          opkaldForsøgt, connects, samtaler, møderSat,
        });
      }
    });
  }
  return rows;
}

// ===========================================================================
// MEETINGS
// ===========================================================================
const REJECTION_REASONS = ["forkert_icp", "ikke_beslutningstager", "intet_reelt_behov", "dårligt_timet", "kunde_dukkede_ikke_op"] as const;

function buildMeetings(clients: ReturnType<typeof buildClients>, campaigns: ReturnType<typeof buildCampaigns>, prospects: ReturnType<typeof buildProspects>) {
  const meetings: any[] = [];
  const [clientA, clientB] = clients;

  // --- own-sales meetings, drawn from prospects in møde_booket / møde_afholdt ---
  const ownProspects = prospects.filter((p) => p.status === "møde_booket" || p.status === "møde_afholdt");
  for (const p of ownProspects) {
    const isPast = p.status === "møde_afholdt";
    const mødeDato = isPast ? fmt(addDays(TODAY, -int(1, 12))) : fmt(addDays(TODAY, int(1, 9)));
    const booketDato = fmt(addDays(new Date(mødeDato), -int(3, 10)));
    meetings.push({
      id: id("meeting"), clientId: null, prospectNavn: p.kontaktperson, virksomhed: p.virksomhed, rolle: p.rolle,
      campaignId: pick(campaigns.filter((c) => c.clientId === null)).id,
      booketDato, mødeDato, kanal: pick(["email", "telefon"] as const),
      status: isPast ? "afholdt" : "planlagt",
      godkendelse: "godkendt", afvisningsårsag: null, faktureres: false,
      noter: "", ownerId: OWNER, godkendelseOpdateretDato: booketDato,
    });
  }
  // pad own-sales meetings up to 8
  while (meetings.length < 8) {
    const mødeDato = fmt(addDays(TODAY, -int(1, 45)));
    meetings.push({
      id: id("meeting"), clientId: null, prospectNavn: contactName(), virksomhed: pick(COMPANY_POOL), rolle: pick(ROLE_POOL),
      campaignId: pick(campaigns.filter((c) => c.clientId === null)).id,
      booketDato: fmt(addDays(new Date(mødeDato), -int(3, 9))), mødeDato,
      kanal: pick(["email", "telefon"] as const), status: "afholdt",
      godkendelse: "godkendt", afvisningsårsag: null, faktureres: false,
      noter: "", ownerId: OWNER, godkendelseOpdateretDato: mødeDato,
    });
  }

  // --- client meetings ---
  function buildClientMeetings(client: any, count: number, opts: { approvalRate: number; noShowRate: number; slowApproval: boolean; icpDrift: boolean }) {
    const emailCampId = campaigns.find((c) => c.clientId === client.id && c.kanal === "email")!.id;
    const phoneCampId = campaigns.find((c) => c.clientId === client.id && c.kanal === "telefon")!.id;
    for (let i = 0; i < count; i++) {
      const daysAgo = Math.round((i / count) * 95) + int(0, 3); // spread across the delivery history
      const mødeDato = fmt(addDays(TODAY, -daysAgo));
      const bookLagDays = opts.slowApproval && chance(0.3) ? int(9, 16) : int(2, 8);
      const booketDato = fmt(addDays(new Date(mødeDato), -bookLagDays));

      let status: string = "afholdt";
      if (daysAgo < 0) status = "planlagt";
      else if (chance(opts.noShowRate)) status = "no_show";
      else if (chance(0.04)) status = "aflyst";
      else if (chance(0.05)) status = "flyttet";

      let godkendelse: string = "godkendt";
      let afvisningsårsag: string | null = null;
      let godkendelseOpdateretDato = mødeDato;
      let faktureres = true;

      if (status === "afholdt") {
        const roll = rand();
        if (roll > opts.approvalRate) {
          godkendelse = "afvist";
          afvisningsårsag = opts.icpDrift && chance(0.55) ? "forkert_icp" : pick(REJECTION_REASONS);
          godkendelseOpdateretDato = fmt(addDays(new Date(mødeDato), int(1, 5)));
          faktureres = false;
        } else if (opts.slowApproval && daysAgo <= 12 && chance(0.35)) {
          godkendelse = "afventer"; // still pending, feeds the aging alert
          faktureres = false;
          godkendelseOpdateretDato = mødeDato;
        } else {
          godkendelse = "godkendt";
          godkendelseOpdateretDato = fmt(addDays(new Date(mødeDato), int(0, 3)));
        }
      } else if (status === "no_show" || status === "aflyst") {
        godkendelse = "afvist";
        afvisningsårsag = "kunde_dukkede_ikke_op";
        faktureres = false;
        godkendelseOpdateretDato = mødeDato;
      } else if (status === "planlagt" || status === "flyttet") {
        godkendelse = "afventer";
        faktureres = false;
      }

      meetings.push({
        id: id("meeting"), clientId: client.id,
        prospectNavn: contactName(), virksomhed: pick(COMPANY_POOL), rolle: pick(ROLE_POOL),
        campaignId: chance(0.75) ? emailCampId : phoneCampId,
        booketDato, mødeDato, kanal: chance(0.75) ? "email" : "telefon",
        status, godkendelse, afvisningsårsag, faktureres,
        noter: "", ownerId: OWNER, godkendelseOpdateretDato,
      });
    }
  }

  buildClientMeetings(clientA, 34, { approvalRate: 0.93, noShowRate: 0.06, slowApproval: false, icpDrift: false });
  buildClientMeetings(clientB, 24, { approvalRate: 0.68, noShowRate: 0.14, slowApproval: true, icpDrift: true });

  // Make September delivery counts tell the exact story: Nordic Gears on pace,
  // Kolding Metal clearly behind. Force a handful of definitely-this-month rows.
  const thisMonthPrefix = fmt(TODAY).slice(0, 7);
  const forceThisMonth = (client: any, howMany: number, statusMix: Array<"afholdt" | "planlagt">) => {
    const campId = campaigns.find((c) => c.clientId === client.id && c.kanal === "email")!.id;
    for (let i = 0; i < howMany; i++) {
      const past = statusMix[i % statusMix.length] === "afholdt";
      const mødeDato = past ? fmt(addDays(TODAY, -int(0, 6))) : fmt(addDays(TODAY, int(1, 5)));
      meetings.push({
        id: id("meeting"), clientId: client.id, prospectNavn: contactName(), virksomhed: pick(COMPANY_POOL), rolle: pick(ROLE_POOL),
        campaignId: campId, booketDato: fmt(addDays(new Date(mødeDato), -int(2, 6))), mødeDato,
        kanal: "email", status: past ? "afholdt" : "planlagt",
        godkendelse: past ? "godkendt" : "afventer", afvisningsårsag: null, faktureres: past,
        noter: "", ownerId: OWNER, godkendelseOpdateretDato: mødeDato,
      });
    }
  };
  forceThisMonth(clientA, 4, ["afholdt", "afholdt", "afholdt", "planlagt"]);
  forceThisMonth(clientB, 1, ["afholdt"]);
  void thisMonthPrefix;

  // Force a couple of definitely-old pending approvals for Kolding Metal so the
  // "afventer godkendelse for længe" alert (and its unbilled amount) is guaranteed
  // to be visible in the seeded demo, not left to chance.
  const koldingEmailCamp = campaigns.find((c) => c.clientId === clientB.id && c.kanal === "email")!.id;
  [11, 6].forEach((daysAgo) => {
    const mødeDato = fmt(addDays(TODAY, -daysAgo));
    meetings.push({
      id: id("meeting"), clientId: clientB.id, prospectNavn: contactName(), virksomhed: pick(COMPANY_POOL), rolle: pick(ROLE_POOL),
      campaignId: koldingEmailCamp, booketDato: fmt(addDays(new Date(mødeDato), -int(3, 6))), mødeDato,
      kanal: "email", status: "afholdt",
      godkendelse: "afventer", afvisningsårsag: null, faktureres: false,
      noter: "", ownerId: OWNER, godkendelseOpdateretDato: mødeDato,
    });
  });

  return meetings;
}

// ===========================================================================
// INVOICES
// ===========================================================================
function buildInvoices(clients: ReturnType<typeof buildClients>) {
  const [clientA, clientB] = clients;
  const monthsBack = (n: number) => {
    const d = new Date(TODAY);
    d.setMonth(d.getMonth() - n);
    return d.toISOString().slice(0, 7);
  };
  const invoices: any[] = [];
  // Nordic Gears — paid on time every month
  [3, 2, 1].forEach((n, idx) => {
    invoices.push({
      id: id("invoice"), clientId: clientA.id, måned: monthsBack(n),
      retainerBeløb: clientA.retainerBeløb, antalFaktureredeMøder: 11 + idx,
      performanceBeløb: (11 + idx) * clientA.performanceBeløbPrMøde,
      total: clientA.retainerBeløb + (11 + idx) * clientA.performanceBeløbPrMøde,
      status: "betalt", forfaldsdato: fmt(addDays(new Date(`${monthsBack(n)}-28`), 14)),
    });
  });
  invoices.push({
    id: id("invoice"), clientId: clientA.id, måned: monthsBack(0),
    retainerBeløb: clientA.retainerBeløb, antalFaktureredeMøder: 0, performanceBeløb: 0,
    total: clientA.retainerBeløb, status: "kladde", forfaldsdato: fmt(addDays(TODAY, 20)),
  });

  // Kolding Metal — one paid, one overdue (feeds the overdue-invoice alert)
  invoices.push({
    id: id("invoice"), clientId: clientB.id, måned: monthsBack(2),
    retainerBeløb: clientB.retainerBeløb, antalFaktureredeMøder: 9,
    performanceBeløb: 9 * clientB.performanceBeløbPrMøde,
    total: clientB.retainerBeløb + 9 * clientB.performanceBeløbPrMøde,
    status: "betalt", forfaldsdato: fmt(addDays(new Date(`${monthsBack(2)}-28`), 14)),
  });
  invoices.push({
    id: id("invoice"), clientId: clientB.id, måned: monthsBack(1),
    retainerBeløb: clientB.retainerBeløb, antalFaktureredeMøder: 4,
    performanceBeløb: 4 * clientB.performanceBeløbPrMøde,
    total: clientB.retainerBeløb + 4 * clientB.performanceBeløbPrMøde,
    status: "forfalden", forfaldsdato: fmt(addDays(TODAY, -6)),
  });
  invoices.push({
    id: id("invoice"), clientId: clientB.id, måned: monthsBack(0),
    retainerBeløb: clientB.retainerBeløb, antalFaktureredeMøder: 0, performanceBeløb: 0,
    total: clientB.retainerBeløb, status: "kladde", forfaldsdato: fmt(addDays(TODAY, 20)),
  });
  return invoices;
}

// ===========================================================================
// INFRASTRUCTURE
// ===========================================================================
function buildInfrastructure(empty: boolean) {
  const base = [
    { id: id("infra"), domæne: "flowaoutreach.dk", antalIndbakker: 5, warmupStatus: "klar" as const, dagligSendekapacitet: 200, bounceRate7d: 1.4, spamklager: 0, status: "sund" as const, oprettet: fmt(addDays(TODAY, -180)), noter: "" },
    { id: id("infra"), domæne: "flowaconnect.dk", antalIndbakker: 5, warmupStatus: "klar" as const, dagligSendekapacitet: 200, bounceRate7d: 6.1, spamklager: 3, status: "brændt" as const, oprettet: fmt(addDays(TODAY, -150)), noter: "Bounce rate steget markant efter listeimport uden verificering. Sat på pause for nyt volumen." },
    { id: id("infra"), domæne: "flowapipeline.dk", antalIndbakker: 4, warmupStatus: "klar" as const, dagligSendekapacitet: 160, bounceRate7d: 2.1, spamklager: 0, status: "sund" as const, oprettet: fmt(addDays(TODAY, -90)), noter: "" },
    { id: id("infra"), domæne: "flowasales.dk", antalIndbakker: 3, warmupStatus: empty ? "opvarmning" as const : "klar" as const, dagligSendekapacitet: empty ? 40 : 120, bounceRate7d: 0.9, spamklager: 0, status: "sund" as const, oprettet: fmt(addDays(TODAY, -25)), noter: "" },
  ];
  return base;
}

// ===========================================================================
// COSTS
// ===========================================================================
function buildCosts(clients: ReturnType<typeof buildClients>) {
  return [
    { id: id("cost"), navn: "Instantly (email-infrastruktur)", beløb: 970, frekvens: "månedlig" as const, kategori: "værktøj" as const, clientId: null },
    { id: id("cost"), navn: "Apollo (data & prospektering)", beløb: 1490, frekvens: "månedlig" as const, kategori: "data" as const, clientId: null },
    { id: id("cost"), navn: "Aircall (telefoni)", beløb: 640, frekvens: "månedlig" as const, kategori: "værktøj" as const, clientId: null },
    { id: id("cost"), navn: "Domæner og DNS", beløb: 380, frekvens: "månedlig" as const, kategori: "domæner" as const, clientId: null },
    { id: id("cost"), navn: "SDR-timer, Nordic Gears", beløb: 6200, frekvens: "månedlig" as const, kategori: "løn" as const, clientId: clients[0].id },
    { id: id("cost"), navn: "SDR-timer, Kolding Metal", beløb: 5400, frekvens: "månedlig" as const, kategori: "løn" as const, clientId: clients[1].id },
    { id: id("cost"), navn: "Bogføring", beløb: 1200, frekvens: "månedlig" as const, kategori: "andet" as const, clientId: null },
  ];
}

// ===========================================================================
// TASKS
// ===========================================================================
function buildTasks(prospects: ReturnType<typeof buildProspects>, clients: ReturnType<typeof buildClients>, meetings: any[]) {
  const tasks: any[] = [];
  const staleProspect = prospects.find((p) => p.status === "kontaktet");
  const offerProspect = prospects.find((p) => p.status === "tilbud_sendt");
  const pendingMeeting = meetings.find((m) => m.godkendelse === "afventer" && m.status === "afholdt" && m.clientId === clients[1].id);

  const push = (t: any) => tasks.push({ id: id("task"), beskrivelse: "", ownerId: OWNER, oprettetDato: fmt(addDays(TODAY, -int(1, 20))), gentagelse: null, knyttetTil: null, ...t });

  push({ titel: "Ring til Martin hos Nordwind", forfaldsdato: fmt(TODAY), prioritet: "høj", status: "åben", knyttetTil: staleProspect ? { type: "prospect", id: staleProspect.id } : null });
  push({ titel: "Følg op på tilbud til Kolding Logistik", forfaldsdato: fmt(addDays(TODAY, -1)), prioritet: "høj", status: "åben", knyttetTil: offerProspect ? { type: "prospect", id: offerProspect.id } : null });
  push({ titel: "Gennemgå ugens outreach-tal", forfaldsdato: fmt(TODAY), prioritet: "mellem", status: "åben", gentagelse: "ugentlig" });
  push({ titel: "Opdater prospect-liste med nye emner", forfaldsdato: fmt(addDays(TODAY, 1)), prioritet: "lav", status: "åben", gentagelse: "ugentlig" });
  push({ titel: "Send statusmail til Nordic Gears", forfaldsdato: fmt(addDays(TODAY, 2)), prioritet: "mellem", status: "åben", knyttetTil: { type: "klient", id: clients[0].id } });
  push({ titel: "Godkend afventende møder hos Kolding Metal", forfaldsdato: fmt(TODAY), prioritet: "kritisk", status: "åben", knyttetTil: pendingMeeting ? { type: "møde", id: pendingMeeting.id } : { type: "klient", id: clients[1].id } });
  push({ titel: "Dagligt tjek: nye svar i indbakken", forfaldsdato: fmt(TODAY), prioritet: "mellem", status: "åben", gentagelse: "daglig" });
  push({ titel: "Book kvartalsgennemgang med Kolding Metal", forfaldsdato: fmt(addDays(TODAY, 5)), prioritet: "høj", status: "åben", knyttetTil: { type: "klient", id: clients[1].id } });
  push({ titel: "Verificér ny prospect-liste før upload", forfaldsdato: fmt(addDays(TODAY, -3)), prioritet: "mellem", status: "afsluttet" });
  push({ titel: "Betal Apollo-faktura", forfaldsdato: fmt(addDays(TODAY, 10)), prioritet: "lav", status: "åben", gentagelse: "månedlig" });
  push({ titel: "Skriv caseudkast baseret på Nordic Gears-resultater", forfaldsdato: fmt(addDays(TODAY, 8)), prioritet: "lav", status: "åben" });
  push({ titel: "Gennemgå afviste møder for mønster i årsager", forfaldsdato: fmt(TODAY), prioritet: "høj", status: "åben", knyttetTil: { type: "klient", id: clients[1].id } });
  push({ titel: "Ryd op i domæne flowaconnect.dk (brændt)", forfaldsdato: fmt(addDays(TODAY, -2)), prioritet: "kritisk", status: "åben" });
  push({ titel: "Forbered ugentlig gennemgang til fredag", forfaldsdato: fmt(addDays(TODAY, (5 - TODAY.getDay() + 7) % 7)), prioritet: "mellem", status: "åben", gentagelse: "ugentlig" });
  push({ titel: "Følg op på LinkedIn-henvisning fra netværk", forfaldsdato: fmt(addDays(TODAY, 3)), prioritet: "lav", status: "åben" });

  return tasks;
}

// ===========================================================================
// GOALS
// ===========================================================================
function buildGoals() {
  const qStartMonth = Math.floor(TODAY.getMonth() / 3) * 3;
  const periodeStart = new Date(TODAY.getFullYear(), qStartMonth, 1);
  const periodeSlut = new Date(TODAY.getFullYear(), qStartMonth + 3, 0);
  const kvartal = `Q${qStartMonth / 3 + 1} ${TODAY.getFullYear()}`;
  return [
    { id: id("goal"), navn: "Nye kunder", type: "kunder" as const, målværdi: 2, periode: kvartal, periodeStart: fmt(periodeStart), periodeSlut: fmt(periodeSlut) },
    { id: id("goal"), navn: "Aktive prospects i pipeline", type: "prospects" as const, målværdi: 20, periode: kvartal, periodeStart: fmt(periodeStart), periodeSlut: fmt(periodeSlut) },
    { id: id("goal"), navn: "Omsætning", type: "omsætning" as const, målværdi: 300000, periode: kvartal, periodeStart: fmt(periodeStart), periodeSlut: fmt(periodeSlut) },
  ];
}

// ===========================================================================
// EMPTY-STATE (real, zero-client) BUILD
// ===========================================================================
function buildEmptyState() {
  const starterCompanies = COMPANY_POOL.slice(0, 11);
  const plan = [
    { status: "ny", count: 4 },
    { status: "kontaktet", count: 3 },
    { status: "svar", count: 2 },
    { status: "tilbud_sendt", count: 1 },
    { status: "tabt", count: 1 },
  ];
  const prospects: any[] = [];
  let cIdx = 0;
  for (const { status, count } of plan) {
    for (let i = 0; i < count; i++) {
      const createdDaysAgo = int(1, 21);
      prospects.push({
        id: id("prospect"), virksomhed: starterCompanies[cIdx++ % starterCompanies.length],
        kontaktperson: contactName(), rolle: pick(ROLE_POOL), kilde: pick(KILDER), status,
        estimeretMånedligVærdi: int(15, 35) * 1000,
        næsteHandling: status === "tilbud_sendt" ? "Følg op på tilbud" : status === "svar" ? "Book møde" : status === "kontaktet" ? "Følg op" : status === "tabt" ? "" : "Første kontakt",
        næsteHandlingDato: status === "tabt" ? null : fmt(addDays(TODAY, int(-2, 5))),
        tabsårsag: status === "tabt" ? pick(TABSAARSAGER) : null,
        noter: "", ownerId: OWNER, oprettetDato: fmt(addDays(TODAY, -createdDaysAgo)),
        stadieSkiftetDato: fmt(addDays(TODAY, -int(0, Math.min(createdDaysAgo, 14)))),
      });
    }
  }

  const campaigns = [
    { id: "camp-own-email", clientId: null, navn: "Flowa – eget salg (email)", kanal: "email" as const, status: "aktiv" as const, startDato: fmt(addDays(TODAY, -14)), slutDato: null, målgruppeBeskrivelse: "Bureau-ejere og salgschefer i danske B2B-virksomheder 20-300 ansatte", antalProspectsIListen: 220, ownerId: OWNER },
    { id: "camp-own-phone", clientId: null, navn: "Flowa – eget salg (telefon)", kanal: "telefon" as const, status: "aktiv" as const, startDato: fmt(addDays(TODAY, -14)), slutDato: null, målgruppeBeskrivelse: "Varme leads og henvisninger", antalProspectsIListen: 40, ownerId: OWNER },
  ];
  const outreach = buildOutreach(campaigns as any);
  const meetings: any[] = [];
  const invoices: any[] = [];
  const infrastructure = buildInfrastructure(true);
  const dummyClients = [{ id: "n/a" }, { id: "n/a" }] as unknown as ReturnType<typeof buildClients>;
  const costs = buildCosts(dummyClients).filter((c) => c.clientId === null);
  const tasks = buildTasks(prospects, dummyClients, []).filter(
    (t) => !t.knyttetTil || (t.knyttetTil.type !== "klient" && t.knyttetTil.type !== "møde"),
  );
  const goals = buildGoals();

  return {
    clients: [], prospects, campaigns, outreach, meetings, invoices, infrastructure, costs, tasks, goals,
    settings, enums, team, alertsState: [], activity: [],
  };
}

function buildFullState() {
  const clients = buildClients();
  const prospects = buildProspects();
  const campaigns = buildCampaigns(clients);
  const outreach = buildOutreach(campaigns);
  const meetings = buildMeetings(clients, campaigns, prospects);
  const invoices = buildInvoices(clients);
  const infrastructure = buildInfrastructure(false);
  const costs = buildCosts(clients);
  const tasks = buildTasks(prospects, clients, meetings);
  const goals = buildGoals();
  const alertsState = [
    {
      alarmId: "seed-example-snooze",
      udsatTil: fmt(addDays(TODAY, 3)),
      begrundelse: "Afventer svar fra kunden, ingen grund til at handle før fredag.",
      udsatAf: OWNER,
      tidspunkt: new Date().toISOString(),
    },
  ];
  return { clients, prospects, campaigns, outreach, meetings, invoices, infrastructure, costs, tasks, goals, settings, enums, team, alertsState, activity: [] };
}

// ---------------------------------------------------------------------------
function main() {
  const empty = process.argv.includes("--empty");
  const dataset = empty ? buildEmptyState() : buildFullState();
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

  const files: Record<string, unknown> = {
    "clients.json": dataset.clients,
    "prospects.json": dataset.prospects,
    "campaigns.json": dataset.campaigns,
    "outreach.json": dataset.outreach,
    "meetings.json": dataset.meetings,
    "invoices.json": dataset.invoices,
    "infrastructure.json": dataset.infrastructure,
    "costs.json": dataset.costs,
    "tasks.json": dataset.tasks,
    "goals.json": dataset.goals,
    "team.json": dataset.team,
    "alerts_state.json": dataset.alertsState,
    "activity.json": dataset.activity,
  };
  for (const [file, content] of Object.entries(files)) {
    writeFileSync(join(DATA_DIR, file), JSON.stringify(content, null, 2) + "\n", "utf-8");
  }
  console.log(`Seedet ${empty ? "TOM (nul-kunde)" : "FULD (demo)"} tilstand:`);
  console.log(`  clients: ${dataset.clients.length}`);
  console.log(`  prospects: ${dataset.prospects.length}`);
  console.log(`  campaigns: ${dataset.campaigns.length}`);
  console.log(`  outreach rows: ${dataset.outreach.length}`);
  console.log(`  meetings: ${dataset.meetings.length}`);
  console.log(`  invoices: ${dataset.invoices.length}`);
  console.log(`  tasks: ${dataset.tasks.length}`);
}

main();
