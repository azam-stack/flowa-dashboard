import { useState } from "react";
import clsx from "clsx";
import { useData } from "@/hooks/useData";
import { todayISO } from "@/lib/dates";
import type { Meeting, Prospect, FlowaTask, Cost } from "@/schema";

type Tab = "møde" | "prospect" | "task" | "omkostning";

export function QuickCapture({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("møde");
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink-900/40 pt-[10vh]" onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-soft" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Hurtig-tilføj">
        <div className="flex border-b border-ink-100 px-2 pt-2">
          {(["møde", "prospect", "task", "omkostning"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={clsx(
                "rounded-t-lg px-3 py-2 text-sm font-medium capitalize",
                tab === t ? "border-b-2 border-brand-500 text-brand-800" : "text-ink-400 hover:text-ink-700",
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="p-4">
          {tab === "møde" && <MeetingForm onDone={onClose} />}
          {tab === "prospect" && <ProspectForm onDone={onClose} />}
          {tab === "task" && <TaskForm onDone={onClose} />}
          {tab === "omkostning" && <CostForm onDone={onClose} />}
        </div>
      </div>
    </div>
  );
}

const inputCls = "w-full rounded-lg border border-ink-200 px-2.5 py-1.5 text-sm focus-visible:outline-brand-600";
const labelCls = "mb-1 block text-xs font-medium text-ink-500";

function SubmitRow({ onDone, label = "Gem" }: { onDone: () => void; label?: string }) {
  return (
    <div className="mt-4 flex justify-end gap-2">
      <button type="button" onClick={onDone} className="rounded-lg px-3 py-1.5 text-sm text-ink-500 hover:bg-ink-50">
        Annullér
      </button>
      <button type="submit" className="rounded-lg bg-brand-500 px-4 py-1.5 text-sm font-semibold text-ink-900 hover:bg-brand-400">
        {label}
      </button>
    </div>
  );
}

function MeetingForm({ onDone }: { onDone: () => void }) {
  const { dataset, create } = useData();
  const [clientId, setClientId] = useState<string>("");
  const [virksomhed, setVirksomhed] = useState("");
  const [prospectNavn, setProspectNavn] = useState("");
  const [rolle, setRolle] = useState("");
  const [kanal, setKanal] = useState<"email" | "telefon">("email");
  const [mødeDato, setMødeDato] = useState(todayISO());
  const [saving, setSaving] = useState(false);
  if (!dataset) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const today = todayISO();
    const isPast = mødeDato <= today;
    const campaign = dataset!.campaigns.find((c) => c.clientId === (clientId || null) && c.kanal === kanal);
    await create<Meeting>("meetings", {
      clientId: clientId || null,
      prospectNavn,
      virksomhed,
      rolle,
      campaignId: campaign?.id ?? null,
      booketDato: today,
      mødeDato,
      kanal,
      status: isPast ? "afholdt" : "planlagt",
      godkendelse: clientId ? "afventer" : "godkendt",
      afvisningsårsag: null,
      faktureres: false,
      noter: "",
      ownerId: "team-azam",
      godkendelseOpdateretDato: today,
    } as Partial<Meeting>);
    setSaving(false);
    onDone();
  }

  return (
    <form onSubmit={submit}>
      <p className="mb-3 text-xs text-ink-400">Den handling du laver oftest — hold den under 10 sekunder.</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Kunde</label>
          <select value={clientId} onChange={(e) => setClientId(e.target.value)} className={inputCls}>
            <option value="">Eget salg</option>
            {dataset.clients.map((c) => (
              <option key={c.id} value={c.id}>{c.navn}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Kanal</label>
          <select value={kanal} onChange={(e) => setKanal(e.target.value as "email" | "telefon")} className={inputCls}>
            <option value="email">Email</option>
            <option value="telefon">Telefon</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Virksomhed</label>
          <input required autoFocus value={virksomhed} onChange={(e) => setVirksomhed(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Kontaktperson</label>
          <input required value={prospectNavn} onChange={(e) => setProspectNavn(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Rolle</label>
          <input value={rolle} onChange={(e) => setRolle(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Mødedato</label>
          <input required type="date" value={mødeDato} onChange={(e) => setMødeDato(e.target.value)} className={inputCls} />
        </div>
      </div>
      <SubmitRow onDone={onDone} label={saving ? "Gemmer…" : "Registrér møde"} />
    </form>
  );
}

function ProspectForm({ onDone }: { onDone: () => void }) {
  const { create } = useData();
  const [virksomhed, setVirksomhed] = useState("");
  const [kontaktperson, setKontaktperson] = useState("");
  const [rolle, setRolle] = useState("");
  const [kilde, setKilde] = useState<Prospect["kilde"]>("cold_email");
  const [værdi, setVærdi] = useState(20000);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const today = todayISO();
    await create<Prospect>("prospects", {
      virksomhed, kontaktperson, rolle, kilde, status: "ny",
      estimeretMånedligVærdi: værdi, næsteHandling: "Første kontakt", næsteHandlingDato: today,
      tabsårsag: null, noter: "", ownerId: "team-azam", oprettetDato: today, stadieSkiftetDato: today,
    } as Partial<Prospect>);
    onDone();
  }

  return (
    <form onSubmit={submit}>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Virksomhed</label>
          <input required autoFocus value={virksomhed} onChange={(e) => setVirksomhed(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Kontaktperson</label>
          <input required value={kontaktperson} onChange={(e) => setKontaktperson(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Rolle</label>
          <input value={rolle} onChange={(e) => setRolle(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Kilde</label>
          <select value={kilde} onChange={(e) => setKilde(e.target.value as Prospect["kilde"])} className={inputCls}>
            <option value="cold_email">Cold email</option>
            <option value="telefon">Telefon</option>
            <option value="linkedin">LinkedIn</option>
            <option value="netværk">Netværk</option>
            <option value="henvisning">Henvisning</option>
          </select>
        </div>
        <div className="col-span-2">
          <label className={labelCls}>Estimeret månedlig værdi (kr.)</label>
          <input type="number" value={værdi} onChange={(e) => setVærdi(Number(e.target.value))} className={inputCls} />
        </div>
      </div>
      <SubmitRow onDone={onDone} label="Tilføj prospect" />
    </form>
  );
}

function TaskForm({ onDone }: { onDone: () => void }) {
  const { create } = useData();
  const [titel, setTitel] = useState("");
  const [forfaldsdato, setForfaldsdato] = useState(todayISO());
  const [prioritet, setPrioritet] = useState<FlowaTask["prioritet"]>("mellem");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await create<FlowaTask>("tasks", {
      titel, beskrivelse: "", forfaldsdato, prioritet, status: "åben", knyttetTil: null, gentagelse: null,
      ownerId: "team-azam", oprettetDato: todayISO(),
    } as Partial<FlowaTask>);
    onDone();
  }

  return (
    <form onSubmit={submit}>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className={labelCls}>Titel</label>
          <input required autoFocus value={titel} onChange={(e) => setTitel(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Forfaldsdato</label>
          <input required type="date" value={forfaldsdato} onChange={(e) => setForfaldsdato(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Prioritet</label>
          <select value={prioritet} onChange={(e) => setPrioritet(e.target.value as FlowaTask["prioritet"])} className={inputCls}>
            <option value="lav">Lav</option>
            <option value="mellem">Mellem</option>
            <option value="høj">Høj</option>
            <option value="kritisk">Kritisk</option>
          </select>
        </div>
      </div>
      <SubmitRow onDone={onDone} label="Tilføj task" />
    </form>
  );
}

function CostForm({ onDone }: { onDone: () => void }) {
  const { dataset, create } = useData();
  const [navn, setNavn] = useState("");
  const [beløb, setBeløb] = useState(0);
  const [frekvens, setFrekvens] = useState<Cost["frekvens"]>("månedlig");
  const [kategori, setKategori] = useState<Cost["kategori"]>("værktøj");
  const [clientId, setClientId] = useState("");
  if (!dataset) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await create<Cost>("costs", { navn, beløb, frekvens, kategori, clientId: clientId || null } as Partial<Cost>);
    onDone();
  }

  return (
    <form onSubmit={submit}>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className={labelCls}>Navn</label>
          <input required autoFocus value={navn} onChange={(e) => setNavn(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Beløb (kr.)</label>
          <input type="number" value={beløb} onChange={(e) => setBeløb(Number(e.target.value))} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Frekvens</label>
          <select value={frekvens} onChange={(e) => setFrekvens(e.target.value as Cost["frekvens"])} className={inputCls}>
            <option value="månedlig">Månedlig</option>
            <option value="kvartalsvis">Kvartalsvis</option>
            <option value="årlig">Årlig</option>
            <option value="engangs">Engangs</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Kategori</label>
          <select value={kategori} onChange={(e) => setKategori(e.target.value as Cost["kategori"])} className={inputCls}>
            <option value="værktøj">Værktøj</option>
            <option value="data">Data</option>
            <option value="domæner">Domæner</option>
            <option value="løn">Løn</option>
            <option value="andet">Andet</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Kunde (valgfri)</label>
          <select value={clientId} onChange={(e) => setClientId(e.target.value)} className={inputCls}>
            <option value="">Delt / ingen</option>
            {dataset.clients.map((c) => (
              <option key={c.id} value={c.id}>{c.navn}</option>
            ))}
          </select>
        </div>
      </div>
      <SubmitRow onDone={onDone} label="Tilføj omkostning" />
    </form>
  );
}
