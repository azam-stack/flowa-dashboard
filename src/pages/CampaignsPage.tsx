import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useData } from "@/hooks/useData";
import { PageHeader } from "@/components/PageHeader";
import { Card, SectionTitle } from "@/components/Card";
import { formatNumber, formatPercent } from "@/lib/format";
import { daysSince, todayISO } from "@/lib/dates";
import type { Campaign, OutreachDay } from "@/schema";

function scopeLabel(clientId: string | null, clients: { id: string; navn: string }[]) {
  return clientId ? clients.find((c) => c.id === clientId)?.navn ?? clientId : "Flowas eget salg";
}

function weeklyTrend(rows: OutreachDay[], ref: string, valueFn: (r: OutreachDay) => number, weeks = 8) {
  const buckets: { week: string; value: number }[] = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const from = w * 7 + 6;
    const to = w * 7;
    const inRange = rows.filter((r) => {
      const age = daysSince(r.dato, ref);
      return age >= to && age <= from;
    });
    buckets.push({ week: `-${w + 1}u`, value: inRange.reduce((s, r) => s + valueFn(r), 0) });
  }
  return buckets;
}

export default function CampaignsPage() {
  const { dataset } = useData();
  const navigate = useNavigate();
  const today = todayISO();
  if (!dataset) return null;

  const emailCampaigns = dataset.campaigns.filter((c) => c.kanal === "email");
  const phoneCampaigns = dataset.campaigns.filter((c) => c.kanal === "telefon");

  const emailStats = useMemo(
    () =>
      emailCampaigns.map((camp) => {
        const rows = dataset.outreach.filter((o) => o.campaignId === camp.id);
        const sendt = rows.reduce((s, r) => s + r.emailsSendt, 0);
        const bounces = rows.reduce((s, r) => s + r.bounces, 0);
        const svar = rows.reduce((s, r) => s + r.svar, 0);
        const positive = rows.reduce((s, r) => s + r.positiveSvar, 0);
        const møder = rows.reduce((s, r) => s + r.møderSat, 0);
        return {
          camp, sendt, bounceRate: sendt > 0 ? bounces / sendt : 0, svarProcent: sendt > 0 ? svar / sendt : 0,
          positivProcent: sendt > 0 ? positive / sendt : 0, møder, mailsPrMøde: møder > 0 ? sendt / møder : null,
        };
      }),
    [dataset, emailCampaigns],
  );

  const phoneStats = useMemo(
    () =>
      phoneCampaigns.map((camp) => {
        const rows = dataset.outreach.filter((o) => o.campaignId === camp.id);
        const forsøgt = rows.reduce((s, r) => s + r.opkaldForsøgt, 0);
        const connects = rows.reduce((s, r) => s + r.connects, 0);
        const samtaler = rows.reduce((s, r) => s + r.samtaler, 0);
        const møder = rows.reduce((s, r) => s + r.møderSat, 0);
        return { camp, forsøgt, connectRate: forsøgt > 0 ? connects / forsøgt : 0, samtaler, møder, opkaldPrMøde: møder > 0 ? forsøgt / møder : null };
      }),
    [dataset, phoneCampaigns],
  );

  const emailTrend = weeklyTrend(dataset.outreach.filter((o) => emailCampaigns.some((c) => c.id === o.campaignId)), today, (r) => (r.emailsSendt > 0 ? r.positiveSvar / r.emailsSendt : 0));
  // aggregate positive-rate trend approximated as sum(positive)/sum(sendt) per week for readability
  const emailTrendAgg = useMemo(() => {
    const rows = dataset.outreach.filter((o) => emailCampaigns.some((c) => c.id === o.campaignId));
    const weeks: { week: string; rate: number }[] = [];
    for (let w = 7; w >= 0; w--) {
      const inRange = rows.filter((r) => { const age = daysSince(r.dato, today); return age >= w * 7 && age <= w * 7 + 6; });
      const sendt = inRange.reduce((s, r) => s + r.emailsSendt, 0);
      const pos = inRange.reduce((s, r) => s + r.positiveSvar, 0);
      weeks.push({ week: `u-${w + 1}`, rate: sendt > 0 ? Math.round((pos / sendt) * 1000) / 10 : 0 });
    }
    return weeks;
  }, [dataset, emailCampaigns, today]);
  void emailTrend;

  return (
    <div>
      <PageHeader title="Kampagner og aktivitet" subtitle="Email og telefon holdes adskilt — de er to forskellige tragte." />

      <Card className="mb-6">
        <SectionTitle>Positiv svarrate, email — seneste 8 uger</SectionTitle>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={emailTrendAgg} margin={{ left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EDE8E1" vertical={false} />
              <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#8C7B66" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#8C7B66" }} axisLine={false} tickLine={false} unit="%" />
              <Tooltip formatter={(v: number) => `${v}%`} />
              <Line type="monotone" dataKey="rate" stroke="#3568C6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <SectionTitle>Cold email</SectionTitle>
      <Card className="mb-6 overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
              <th className="py-2 font-medium">Kampagne</th>
              <th className="font-medium">Ejer</th>
              <th className="num font-medium">Sendt</th>
              <th className="num font-medium">Bounce</th>
              <th className="num font-medium">Svar%</th>
              <th className="num font-medium">Positiv%</th>
              <th className="num font-medium">Møder</th>
              <th className="num font-medium">Mails/møde</th>
            </tr>
          </thead>
          <tbody>
            {emailStats.map(({ camp, sendt, bounceRate, svarProcent, positivProcent, møder, mailsPrMøde }) => (
              <tr key={camp.id} onClick={() => navigate(`/kampagner/${camp.id}`)} className="cursor-pointer border-b border-ink-50 hover:bg-brand-50/40">
                <td className="py-2 font-medium text-ink-800">{camp.navn}</td>
                <td className="text-ink-500">{scopeLabel(camp.clientId, dataset.clients)}</td>
                <td className="num">{formatNumber(sendt)}</td>
                <td className={`num ${bounceRate >= 0.05 ? "text-status-crit" : bounceRate >= 0.03 ? "text-status-warn" : ""}`}>{formatPercent(bounceRate, 1)}</td>
                <td className="num">{formatPercent(svarProcent, 1)}</td>
                <td className="num">{formatPercent(positivProcent, 1)}</td>
                <td className="num">{formatNumber(møder)}</td>
                <td className="num">{mailsPrMøde ? formatNumber(mailsPrMøde) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <SectionTitle>Telefon</SectionTitle>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
              <th className="py-2 font-medium">Kampagne</th>
              <th className="font-medium">Ejer</th>
              <th className="num font-medium">Opkald</th>
              <th className="num font-medium">Connect%</th>
              <th className="num font-medium">Samtaler</th>
              <th className="num font-medium">Møder</th>
              <th className="num font-medium">Opkald/møde</th>
            </tr>
          </thead>
          <tbody>
            {phoneStats.map(({ camp, forsøgt, connectRate, samtaler, møder, opkaldPrMøde }) => (
              <tr key={camp.id} onClick={() => navigate(`/kampagner/${camp.id}`)} className="cursor-pointer border-b border-ink-50 hover:bg-brand-50/40">
                <td className="py-2 font-medium text-ink-800">{camp.navn}</td>
                <td className="text-ink-500">{scopeLabel(camp.clientId, dataset.clients)}</td>
                <td className="num">{formatNumber(forsøgt)}</td>
                <td className="num">{formatPercent(connectRate, 1)}</td>
                <td className="num">{formatNumber(samtaler)}</td>
                <td className="num">{formatNumber(møder)}</td>
                <td className="num">{opkaldPrMøde ? formatNumber(opkaldPrMøde) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
