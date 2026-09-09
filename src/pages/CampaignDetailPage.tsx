import { useParams, Link } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useData, useEnumLabel } from "@/hooks/useData";
import { PageHeader } from "@/components/PageHeader";
import { Card, SectionTitle } from "@/components/Card";
import { MetricTile } from "@/components/MetricTile";
import { formatNumber, formatPercent } from "@/lib/format";
import { daysSince, todayISO } from "@/lib/dates";

export default function CampaignDetailPage() {
  const { campaignId } = useParams();
  const { dataset } = useData();
  const enumLabel = useEnumLabel();
  const today = todayISO();
  if (!dataset) return null;
  const campaign = dataset.campaigns.find((c) => c.id === campaignId);
  if (!campaign) return <p className="text-sm text-ink-500">Kampagnen findes ikke.</p>;

  const rows = dataset.outreach.filter((o) => o.campaignId === campaign.id).sort((a, b) => (a.dato < b.dato ? -1 : 1));
  const isEmail = campaign.kanal === "email";
  const client = campaign.clientId ? dataset.clients.find((c) => c.id === campaign.clientId) : null;

  const recent = rows.filter((r) => daysSince(r.dato, today) <= 14);
  const previous = rows.filter((r) => daysSince(r.dato, today) > 14 && daysSince(r.dato, today) <= 28);
  const rate = (arr: typeof rows) => {
    if (isEmail) {
      const sendt = arr.reduce((s, r) => s + r.emailsSendt, 0);
      const pos = arr.reduce((s, r) => s + r.positiveSvar, 0);
      return sendt > 0 ? pos / sendt : null;
    }
    const forsøgt = arr.reduce((s, r) => s + r.opkaldForsøgt, 0);
    const samtaler = arr.reduce((s, r) => s + r.samtaler, 0);
    return forsøgt > 0 ? samtaler / forsøgt : null;
  };
  const recentRate = rate(recent);
  const prevRate = rate(previous);
  const drop = recentRate !== null && prevRate !== null && prevRate > 0 ? (1 - recentRate / prevRate) * 100 : null;

  const weekly: { week: string; rate: number; møder: number }[] = [];
  for (let w = 7; w >= 0; w--) {
    const inRange = rows.filter((r) => daysSince(r.dato, today) >= w * 7 && daysSince(r.dato, today) <= w * 7 + 6);
    const r = rate(inRange);
    weekly.push({ week: `u-${w + 1}`, rate: r !== null ? Math.round(r * 1000) / 10 : 0, møder: inRange.reduce((s, x) => s + x.møderSat, 0) });
  }

  const totals = {
    sendt: rows.reduce((s, r) => s + r.emailsSendt, 0),
    møder: rows.reduce((s, r) => s + r.møderSat, 0),
    forsøgt: rows.reduce((s, r) => s + r.opkaldForsøgt, 0),
  };

  return (
    <div>
      <Link to="/kampagner" className="text-xs text-ink-400 hover:text-ink-700">← Kampagner</Link>
      <PageHeader
        title={campaign.navn}
        subtitle={`${client ? client.navn : "Flowas eget salg"} · ${enumLabel("kanal", campaign.kanal)} · ${campaign.målgruppeBeskrivelse}`}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricTile
          label={isEmail ? "Positiv svarrate, 14 dage" : "Samtalerate, 14 dage"}
          value={recentRate !== null ? formatPercent(recentRate, 1) : "—"}
          level={drop === null ? undefined : drop >= 20 ? "kritisk" : drop >= 10 ? "advarsel" : "sund"}
          meaning={drop !== null && drop > 0 ? `Faldet ${formatNumber(drop)}% ift. de foregående 14 dage.` : "Stabilt eller stigende ift. foregående periode."}
        />
        <MetricTile label={isEmail ? "Mails sendt i alt" : "Opkald forsøgt i alt"} value={formatNumber(isEmail ? totals.sendt : totals.forsøgt)} meaning="Samlet volumen i kampagnens levetid." />
        <MetricTile label="Møder sat i alt" value={formatNumber(totals.møder)} meaning={isEmail && totals.møder > 0 ? `${formatNumber(totals.sendt / totals.møder)} mails pr. booket møde.` : ""} />
      </div>

      <Card>
        <SectionTitle>{isEmail ? "Positiv svarrate" : "Samtalerate"} og møder, seneste 8 uger</SectionTitle>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={weekly} margin={{ left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EDE8E1" vertical={false} />
              <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#8C7B66" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#8C7B66" }} axisLine={false} tickLine={false} unit="%" />
              <Tooltip />
              <Line type="monotone" dataKey="rate" stroke="#3568C6" strokeWidth={2} dot={false} name={isEmail ? "Positiv%" : "Samtale%"} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
