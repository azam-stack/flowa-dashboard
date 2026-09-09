import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from "recharts";
import { useData, useEnumLabel } from "@/hooks/useData";
import { PageHeader } from "@/components/PageHeader";
import { Card, SectionTitle } from "@/components/Card";
import { MetricTile } from "@/components/MetricTile";
import { StatusPill } from "@/components/StatusPill";
import { ExportButton } from "@/components/ExportButton";
import { formatDKK, formatNumber } from "@/lib/format";
import { clientMonthlyEconomics } from "@/lib/alerts";
import { daysSince, monthOf, todayISO, formatDateDa } from "@/lib/dates";

export default function EconomyPage() {
  const { dataset } = useData();
  const enumLabel = useEnumLabel();
  const today = todayISO();
  if (!dataset) return null;

  const activeClients = dataset.clients.filter((c) => c.status === "aktiv" || c.status === "onboarding");
  const economics = activeClients.map((c) => ({ client: c, eco: clientMonthlyEconomics(c, dataset) }));
  const totalRevenue = economics.reduce((s, x) => s + x.eco.revenue, 0);
  const totalMargin = economics.reduce((s, x) => s + x.eco.dækningsbidrag, 0);

  const goal = dataset.goals.find((g) => g.type === "omsætning");
  const monthlyTarget = goal ? goal.målværdi / 3 : null;

  const monthsBack = (n: number) => {
    const d = new Date(today);
    d.setMonth(d.getMonth() - n);
    return d.toISOString().slice(0, 7);
  };
  const revenueHistory = [3, 2, 1, 0].map((n) => {
    const monthKey = monthsBack(n);
    if (n === 0) return { month: monthKey.slice(5), omsætning: totalRevenue };
    const invs = dataset.invoices.filter((i) => i.måned === monthKey && i.status !== "kladde");
    return { month: monthKey.slice(5), omsætning: invs.reduce((s, i) => s + i.total, 0) };
  });

  const overdue = dataset.invoices.filter((i) => i.status === "forfalden" || (i.status === "sendt" && i.forfaldsdato < today)).sort((a, b) => a.forfaldsdato < b.forfaldsdato ? -1 : 1);
  const upcoming = dataset.invoices.filter((i) => daysSince(today, i.forfaldsdato) >= 0 && daysSince(today, i.forfaldsdato) <= 30 && i.status !== "betalt");
  const rest = dataset.invoices.filter((i) => !overdue.includes(i) && !upcoming.includes(i));

  return (
    <div>
      <PageHeader title="Økonomi" subtitle="Tjener vi penge på hver enkelt kunde, når performance og omkostninger er talt med?" action={<ExportButton rows={dataset.invoices} filename="fakturaer" />} />

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricTile label="Omsætning denne måned" value={formatDKK(totalRevenue)} meaning={monthlyTarget ? `Mål ca. ${formatDKK(monthlyTarget)}/md (kvartalsmål ${formatDKK(goal!.målværdi)}).` : "Retainer + performance på tværs af aktive kunder."} />
        <MetricTile
          label="Samlet dækningsbidrag"
          value={formatDKK(totalMargin)}
          level={totalMargin >= 0 ? "sund" : "kritisk"}
          meaning={totalMargin >= 0 ? "Positivt efter direkte og fordelte omkostninger." : "Negativt — se hvilken kunde der trækker ned nedenfor."}
        />
        <MetricTile label="Forfaldne fakturaer" value={formatDKK(overdue.reduce((s, i) => s + i.total, 0))} level={overdue.length === 0 ? "sund" : "kritisk"} meaning={overdue.length === 0 ? "Ingen." : `${overdue.length} faktura(er) skal rykkes nu.`} />
      </div>

      <Card className="mb-6">
        <SectionTitle>Omsætning pr. måned</SectionTitle>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={revenueHistory} margin={{ left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EDE8E1" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#8C7B66" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "#8C7B66" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <Tooltip formatter={(v: number) => formatDKK(v)} />
              {monthlyTarget && <ReferenceLine y={monthlyTarget} stroke="#EE9E47" strokeDasharray="4 4" label={{ value: "Mål", fontSize: 11, fill: "#B4661F" }} />}
              <Bar dataKey="omsætning" fill="#1C8F6B" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="mb-6 overflow-x-auto">
        <SectionTitle>Pr. kunde denne måned</SectionTitle>
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
              <th className="py-2 font-medium">Kunde</th>
              <th className="num font-medium">Honorar</th>
              <th className="num font-medium">Omkostninger</th>
              <th className="num font-medium">Dækningsbidrag</th>
              <th className="num font-medium">Kr./leveret møde</th>
            </tr>
          </thead>
          <tbody>
            {economics.map(({ client, eco }) => (
              <tr key={client.id} className="border-b border-ink-50">
                <td className="py-2 font-medium text-ink-800">{client.navn}</td>
                <td className="num">{formatDKK(eco.revenue)}</td>
                <td className="num">{formatDKK(eco.totalCosts)}</td>
                <td className={`num font-semibold ${eco.dækningsbidrag >= 0 ? "text-status-good" : "text-status-crit"}`}>{formatDKK(eco.dækningsbidrag)}</td>
                <td className="num">{eco.costPerMeeting ? formatDKK(eco.costPerMeeting) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle>Fakturaer — forfaldne først</SectionTitle>
          <ul className="space-y-1.5">
            {[...overdue, ...upcoming, ...rest].map((inv) => {
              const client = dataset.clients.find((c) => c.id === inv.clientId);
              const isOverdue = overdue.includes(inv);
              return (
                <li key={inv.id} className="flex items-center justify-between rounded-lg border border-ink-100 px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium text-ink-800">{client?.navn} — {inv.måned}</p>
                    <p className="text-xs text-ink-500">Forfald {formatDateDa(inv.forfaldsdato)}</p>
                  </div>
                  <div className="text-right">
                    <p className="num font-medium text-ink-800">{formatDKK(inv.total)}</p>
                    {inv.status === "kladde" ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-ink-100 px-2.5 py-1 text-xs font-medium text-ink-500">Kladde</span>
                    ) : (
                      <StatusPill level={isOverdue ? "kritisk" : inv.status === "betalt" ? "sund" : "advarsel"} label={enumLabel("invoiceStatus", inv.status)} />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
        <Card>
          <SectionTitle>Forventet indgang, næste 30 dage</SectionTitle>
          <p className="num font-display text-3xl font-semibold text-ink-900">{formatDKK(upcoming.reduce((s, i) => s + i.total, 0))}</p>
          <p className="mt-1 text-sm text-ink-500">{formatNumber(upcoming.length)} faktura(er) forfalder i perioden.</p>
        </Card>
      </div>
    </div>
  );
}
