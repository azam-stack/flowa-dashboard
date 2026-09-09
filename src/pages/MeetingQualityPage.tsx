import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useData, useEnumLabel } from "@/hooks/useData";
import { PageHeader } from "@/components/PageHeader";
import { Card, SectionTitle } from "@/components/Card";
import { MetricTile } from "@/components/MetricTile";
import { ExportButton } from "@/components/ExportButton";
import { formatDKK, formatNumber, formatPercent } from "@/lib/format";
import { daysSince, daysBetween, todayISO } from "@/lib/dates";
import type { Meeting } from "@/schema";

const REJECTION_REASONS: Array<{ key: NonNullable<Meeting["afvisningsårsag"]>; label: string }> = [
  { key: "forkert_icp", label: "Forkert ICP" },
  { key: "ikke_beslutningstager", label: "Ikke beslutningstager" },
  { key: "intet_reelt_behov", label: "Intet reelt behov" },
  { key: "dårligt_timet", label: "Dårligt timet" },
  { key: "kunde_dukkede_ikke_op", label: "Kunden dukkede ikke op" },
];

function approvalRate(meetings: Meeting[]) {
  const decided = meetings.filter((m) => m.godkendelse === "godkendt" || m.godkendelse === "afvist");
  if (decided.length === 0) return null;
  return decided.filter((m) => m.godkendelse === "godkendt").length / decided.length;
}

export default function MeetingQualityPage() {
  const { dataset, update } = useData();
  const enumLabel = useEnumLabel();
  const [params] = useSearchParams();
  const clientFilter = params.get("client");
  const initialFilter = params.get("filter") === "afventer";
  const [onlyPending, setOnlyPending] = useState(initialFilter);
  const today = todayISO();

  if (!dataset) return null;
  const clientMeetings = dataset.meetings.filter((m) => m.clientId && (!clientFilter || m.clientId === clientFilter));

  const overallRate = approvalRate(clientMeetings);
  const held = clientMeetings.filter((m) => ["afholdt", "no_show"].includes(m.status));
  const noShowRate = held.length > 0 ? held.filter((m) => m.status === "no_show").length / held.length : null;
  const bookingLag = clientMeetings.filter((m) => m.status === "afholdt").map((m) => daysBetween(m.booketDato, m.mødeDato));
  const avgLag = bookingLag.length > 0 ? bookingLag.reduce((a, b) => a + b, 0) / bookingLag.length : null;

  const byClient = dataset.clients.map((c) => ({
    client: c,
    rate: approvalRate(dataset.meetings.filter((m) => m.clientId === c.id)),
  })).filter((x) => x.rate !== null);

  const byCampaign = dataset.campaigns.filter((c) => c.clientId).map((camp) => ({
    campaign: camp,
    rate: approvalRate(dataset.meetings.filter((m) => m.campaignId === camp.id)),
  })).filter((x) => x.rate !== null);

  const rejectionDist = useMemo(() => {
    const rejected = clientMeetings.filter((m) => m.godkendelse === "afvist" && m.afvisningsårsag);
    return REJECTION_REASONS.map((r) => ({
      name: r.label,
      count: rejected.filter((m) => m.afvisningsårsag === r.key).length,
    }));
  }, [clientMeetings]);

  const pending = clientMeetings
    .filter((m) => m.godkendelse === "afventer" && m.status === "afholdt")
    .map((m) => ({ ...m, age: daysSince(m.godkendelseOpdateretDato, today) }))
    .sort((a, b) => b.age - a.age);

  const shownPending = onlyPending || pending.length > 0 ? pending : [];

  async function decide(id: string, godkendelse: "godkendt" | "afvist", reason?: Meeting["afvisningsårsag"]) {
    await update<Meeting>("meetings", id, {
      godkendelse,
      afvisningsårsag: godkendelse === "afvist" ? reason ?? "forkert_icp" : null,
      godkendelseOpdateretDato: today,
      faktureres: godkendelse === "godkendt",
    });
  }

  return (
    <div>
      <PageHeader title="Mødekvalitet" subtitle="Godkendelsesstatus er faktureringsgrundlag, ikke en note." action={<ExportButton rows={clientMeetings} filename="moeder" />} />

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <MetricTile
          label="Godkendelsesrate"
          value={overallRate !== null ? formatPercent(overallRate) : "—"}
          level={overallRate === null ? undefined : overallRate >= 0.8 ? "sund" : overallRate >= 0.65 ? "advarsel" : "kritisk"}
          meaning="Andel af afgjorte møder kunden har godkendt."
        />
        <MetricTile
          label="No-show-rate"
          value={noShowRate !== null ? formatPercent(noShowRate) : "—"}
          level={noShowRate === null ? undefined : noShowRate <= 0.08 ? "sund" : noShowRate <= 0.15 ? "advarsel" : "kritisk"}
          meaning="Andel af afholdte/no-show møder hvor prospektet ikke dukkede op."
        />
        <MetricTile
          label="Booking → afholdt"
          value={avgLag !== null ? `${formatNumber(avgLag, 1)} dage` : "—"}
          meaning="Lang ventetid mellem booking og møde giver flere no-shows."
        />
        <MetricTile
          label="Afventer godkendelse"
          value={formatNumber(pending.length)}
          level={pending.length === 0 ? "sund" : pending.some((p) => p.age >= dataset.settings.alarmTærskler.godkendelseAfventerKritiskDage) ? "kritisk" : "advarsel"}
          meaning={pending.length === 0 ? "Ingen møder venter." : `Ældste har ventet ${formatNumber(Math.max(...pending.map((p) => p.age)))} dage.`}
        />
      </div>

      <Card className="mb-6">
        <SectionTitle
          action={
            <button onClick={() => setOnlyPending((v) => !v)} className="text-xs font-medium text-brand-800 hover:underline">
              {onlyPending ? "Vis alle møder" : "Vis kun afventende"}
            </button>
          }
        >
          Arbejdsliste — møder der afventer godkendelse
        </SectionTitle>
        {shownPending.length === 0 ? (
          <p className="text-sm text-ink-400">Ingen møder afventer godkendelse. Godt gået.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
                <th className="py-2 font-medium">Prospect</th>
                <th className="font-medium">Kunde</th>
                <th className="font-medium">Mødedato</th>
                <th className="num font-medium">Alder</th>
                <th className="font-medium">Handling</th>
              </tr>
            </thead>
            <tbody>
              {shownPending.map((m) => {
                const client = dataset.clients.find((c) => c.id === m.clientId);
                return (
                  <tr key={m.id} className="border-b border-ink-50">
                    <td className="py-2">{m.prospectNavn} <span className="text-ink-400">· {m.virksomhed}</span></td>
                    <td>{client?.navn}</td>
                    <td className="num">{m.mødeDato}</td>
                    <td className={`num ${m.age >= dataset.settings.alarmTærskler.godkendelseAfventerKritiskDage ? "font-semibold text-status-crit" : ""}`}>{m.age}d</td>
                    <td>
                      <div className="flex gap-1.5">
                        <button onClick={() => decide(m.id, "godkendt")} className="rounded-lg bg-status-good-bg px-2 py-1 text-xs font-medium text-status-good hover:opacity-80">
                          Godkend
                        </button>
                        <select
                          defaultValue=""
                          onChange={(e) => e.target.value && decide(m.id, "afvist", e.target.value as Meeting["afvisningsårsag"])}
                          className="rounded-lg border border-ink-200 bg-status-crit-bg px-2 py-1 text-xs font-medium text-status-crit"
                        >
                          <option value="" disabled>Afvis…</option>
                          {REJECTION_REASONS.map((r) => (
                            <option key={r.key} value={r.key}>{r.label}</option>
                          ))}
                        </select>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <SectionTitle>Godkendelsesrate pr. kunde</SectionTitle>
          <ul className="space-y-1.5">
            {byClient.map(({ client, rate }) => (
              <li key={client.id} className="flex items-center justify-between text-sm">
                <span className="text-ink-600">{client.navn}</span>
                <span className={`num font-medium ${rate! >= 0.8 ? "text-status-good" : rate! >= 0.65 ? "text-status-warn" : "text-status-crit"}`}>{formatPercent(rate!)}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <SectionTitle>Godkendelsesrate pr. kampagne</SectionTitle>
          <ul className="space-y-1.5">
            {byCampaign.map(({ campaign, rate }) => (
              <li key={campaign.id} className="flex items-center justify-between text-sm">
                <span className="truncate text-ink-600">{campaign.navn}</span>
                <span className={`num shrink-0 font-medium ${rate! >= 0.8 ? "text-status-good" : rate! >= 0.65 ? "text-status-warn" : "text-status-crit"}`}>{formatPercent(rate!)}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <SectionTitle>Afvisningsårsager</SectionTitle>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rejectionDist} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EDE8E1" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#8C7B66" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#4E4130" }} width={110} axisLine={false} tickLine={false} />
                <Tooltip />
                <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                  {rejectionDist.map((_, i) => (
                    <Cell key={i} fill="#C4433A" fillOpacity={0.55 + i * 0.09} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-1 text-xs text-ink-500">Det hyppigste mønster i afvisningerne er stedet at rette targeting.</p>
        </Card>
      </div>
    </div>
  );
}
