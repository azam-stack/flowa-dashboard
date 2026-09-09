import { useNavigate } from "react-router-dom";
import { useData } from "@/hooks/useData";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { StatusPill } from "@/components/StatusPill";
import { formatNumber, formatPercent } from "@/lib/format";
import { monthDeliverySummary, clientHealthScore, contractCountdown } from "@/lib/delivery";

export default function DeliveryPage() {
  const { dataset } = useData();
  const navigate = useNavigate();
  if (!dataset) return null;

  const clients = dataset.clients.filter((c) => c.status !== "opsagt");

  if (clients.length === 0) {
    return (
      <div>
        <PageHeader title="Levering" subtitle="Møder vi producerer for hver kunde." />
        <EmptyState
          title="Klar til at levere, når den første kunde skriver under"
          body="Der er ikke noget at måle endnu — det er rigtigt lige nu. I det øjeblik I lander en kunde, dukker kvote, tempo og godkendelsesrate op her automatisk. Brug tiden på Eget salg."
          action={
            <button onClick={() => navigate("/eget-salg")} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-ink-900 hover:bg-brand-400">
              Gå til eget salg
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Levering" subtitle="Fra den første kunde skriver under, er det her forretningen lever eller dør." />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {clients.map((client) => {
          const delivery = monthDeliverySummary(client, dataset);
          const health = clientHealthScore(client, dataset);
          const countdown = contractCountdown(client);
          return (
            <button
              key={client.id}
              onClick={() => navigate(`/levering/${client.id}`)}
              className="rounded-2xl border border-ink-100 bg-white p-5 text-left transition hover:border-brand-300 hover:shadow-card"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display text-lg font-semibold text-ink-900">{client.navn}</p>
                  <p className="text-xs text-ink-400">{client.status === "onboarding" ? "Onboarding" : "Aktiv"}</p>
                </div>
                <StatusPill level={delivery.vurdering} />
              </div>
              <div className="num mt-3 flex items-baseline gap-1.5">
                <span className="font-display text-2xl font-semibold text-ink-900">{formatNumber(delivery.leveret)}</span>
                <span className="text-sm text-ink-400">/ {formatNumber(delivery.kvote)} møder denne måned</span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
                <div
                  className={`h-full rounded-full ${delivery.vurdering === "sund" ? "bg-status-good" : delivery.vurdering === "advarsel" ? "bg-status-warn" : "bg-status-crit"}`}
                  style={{ width: `${Math.min(100, (delivery.leveret / delivery.kvote) * 100)}%` }}
                />
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-ink-500">
                <span>Health-score: <span className="num font-medium text-ink-700">{health.score}/100</span></span>
                {countdown && <span>{countdown.daysToEnd} dage til kontraktslut</span>}
              </div>
              {health.niveau !== "sund" && <p className="mt-2 text-xs text-status-crit">{health.begrundelse}</p>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
