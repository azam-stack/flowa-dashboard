import { useParams, Link } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from "recharts";
import { useData } from "@/hooks/useData";
import { PageHeader } from "@/components/PageHeader";
import { Card, SectionTitle } from "@/components/Card";
import { MetricTile } from "@/components/MetricTile";
import { StatusPill } from "@/components/StatusPill";
import { formatDKK, formatNumber, formatPercent } from "@/lib/format";
import { monthDeliverySummary, cumulativeContractDelivery, contractCountdown, clientHealthScore } from "@/lib/delivery";
import { meetingsCountingTowardQuota } from "@/lib/alerts";
import { formatDateDa } from "@/lib/dates";

export default function DeliveryClientPage() {
  const { clientId } = useParams();
  const { dataset } = useData();
  if (!dataset) return null;
  const client = dataset.clients.find((c) => c.id === clientId);
  if (!client) return <p className="text-sm text-ink-500">Kunden findes ikke.</p>;

  const delivery = monthDeliverySummary(client, dataset);
  const cumulative = cumulativeContractDelivery(client, dataset);
  const countdown = contractCountdown(client);
  const health = clientHealthScore(client, dataset);

  const chartData = cumulative.monthsSpanned.slice(-6).map((monthKey) => ({
    month: monthKey.slice(5),
    leveret: meetingsCountingTowardQuota(dataset.meetings, client.id, monthKey).length,
  }));

  return (
    <div>
      <Link to="/levering" className="text-xs text-ink-400 hover:text-ink-700">← Levering</Link>
      <PageHeader
        title={client.navn}
        subtitle={`${client.icpBeskrivelse} · Performance udløses ved: ${client.performanceUdløser === "booket" ? "booking" : client.performanceUdløser === "afholdt" ? "afholdt møde" : "kundens godkendelse"}`}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricTile
          label="Denne måned"
          value={`${formatNumber(delivery.leveret)} / ${formatNumber(delivery.kvote)}`}
          level={delivery.vurdering}
          meaning={
            delivery.vurdering === "sund"
              ? `På tempo. ${formatNumber(delivery.pacing.remainingWorkdays)} arbejdsdage tilbage af måneden.`
              : delivery.perResterendeArbejdsdag !== null
                ? `Kræver ${formatNumber(delivery.perResterendeArbejdsdag, 2)} møder/dag resten af måneden mod ${formatNumber(delivery.hidtilPerArbejdsdag, 2)} hidtil.`
                : `Måneden er slut på arbejdsdage — kvoten kan ikke nås som planlagt.`
          }
        />
        <MetricTile
          label="Prognose for måneden"
          value={`${formatNumber(delivery.prognose)} møder`}
          level={delivery.prognose >= delivery.kvote ? "sund" : delivery.prognose >= delivery.kvote * 0.8 ? "advarsel" : "kritisk"}
          meaning={delivery.prognose >= delivery.kvote ? "Fortsætter tempoet, rammer I kvoten." : `${formatNumber(Math.max(0, delivery.kvote - delivery.prognose))} møder under kvote ved uændret tempo.`}
        />
        <MetricTile
          label="Health-score"
          value={`${health.score}/100`}
          level={health.niveau}
          meaning={health.begrundelse}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionTitle>Leverede møder, seneste måneder</SectionTitle>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EDE8E1" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#8C7B66" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "#8C7B66" }} axisLine={false} tickLine={false} />
                <Tooltip />
                <ReferenceLine y={client.aftalteMøderPrMd} stroke="#EE9E47" strokeDasharray="4 4" label={{ value: "Kvote", fontSize: 11, fill: "#B4661F" }} />
                <Bar dataKey="leveret" fill="#3568C6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-xs text-ink-500">Stiplet linje er den aftalte kvote pr. måned.</p>
        </Card>

        <div className="space-y-6">
          <Card>
            <SectionTitle>Kumulativ levering</SectionTitle>
            <p className="num font-display text-3xl font-semibold text-ink-900">{formatPercent(cumulative.grad)}</p>
            <p className="mt-1 text-sm text-ink-500">
              {formatNumber(cumulative.totalDelivered)} af {formatNumber(cumulative.totalExpected)} forventede møder leveret siden kontraktstart ({formatDateDa(client.startDato)}).
            </p>
          </Card>
          <Card>
            <SectionTitle>Kontrakt</SectionTitle>
            {countdown ? (
              <>
                <p className="num font-display text-3xl font-semibold text-ink-900">{formatNumber(countdown.daysToEnd)} dage</p>
                <p className="mt-1 text-sm text-ink-500">til kontraktslut ({formatDateDa(client.kontraktSlut!)}).</p>
                <p className="mt-2 text-sm">
                  {countdown.noticeDeadline <= 0 ? (
                    <span className="font-medium text-status-crit">Opsigelsesvarslet på {client.opsigelsesvarsel} dage er allerede indenfor rækkevidde.</span>
                  ) : (
                    <span className="text-ink-500">Opsigelsesvarsel på {client.opsigelsesvarsel} dage indtræder om {formatNumber(countdown.noticeDeadline)} dage.</span>
                  )}
                </p>
              </>
            ) : (
              <p className="text-sm text-ink-500">Ingen kontraktslutdato registreret — løbende aftale.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
