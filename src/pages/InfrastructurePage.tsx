import { useData, useEnumLabel } from "@/hooks/useData";
import { PageHeader } from "@/components/PageHeader";
import { Card, SectionTitle } from "@/components/Card";
import { MetricTile } from "@/components/MetricTile";
import { StatusPill } from "@/components/StatusPill";
import { ExportButton } from "@/components/ExportButton";
import { formatNumber, formatPercent } from "@/lib/format";
import { formatDateDa } from "@/lib/dates";
import { computeCapacitySummary } from "@/lib/capacity";

export default function InfrastructurePage() {
  const { dataset } = useData();
  const enumLabel = useEnumLabel();
  if (!dataset) return null;

  const capacity = computeCapacitySummary(dataset);
  const healthy = dataset.infrastructure.filter((d) => d.status === "sund").length;

  return (
    <div>
      <PageHeader title="Afsenderinfrastruktur" subtitle="Kan vi overhovedet levere det vi har solgt?" action={<ExportButton rows={dataset.infrastructure} filename="infrastruktur" />} />

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricTile
          label="Domæner sunde"
          value={`${healthy} / ${dataset.infrastructure.length}`}
          level={healthy === dataset.infrastructure.length ? "sund" : "advarsel"}
          meaning="Domæner der hverken er brændte eller har forhøjet bounce rate."
        />
        <MetricTile
          label="Samlet sendekapacitet"
          value={`${formatNumber(capacity.healthyEmailCapacity)}/dag`}
          meaning="Fra domæner der ikke er brændte."
        />
        <MetricTile
          label="Udnyttelse"
          value={formatPercent(capacity.emailUtilization)}
          level={capacity.emailUtilization >= 1 ? "kritisk" : capacity.emailUtilization >= 0.9 ? "advarsel" : "sund"}
          meaning={capacity.emailUtilization >= 0.9 ? "Lidt eller intet råderum tilbage til ny volumen." : "Der er råderum til mere volumen."}
        />
      </div>

      <Card className="overflow-x-auto">
        <SectionTitle>Domæner</SectionTitle>
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
              <th className="py-2 font-medium">Domæne</th>
              <th className="font-medium">Status</th>
              <th className="font-medium">Warmup</th>
              <th className="num font-medium">Indbakker</th>
              <th className="num font-medium">Kapacitet/dag</th>
              <th className="num font-medium">Bounce 7d</th>
              <th className="num font-medium">Spamklager</th>
              <th className="font-medium">Oprettet</th>
            </tr>
          </thead>
          <tbody>
            {dataset.infrastructure.map((d) => (
              <tr key={d.id} className="border-b border-ink-50">
                <td className="py-2 font-medium text-ink-800">{d.domæne}</td>
                <td><StatusPill level={d.status === "brændt" ? "kritisk" : d.status === "advarsel" ? "advarsel" : "sund"} label={enumLabel("infraStatus", d.status)} /></td>
                <td className="text-ink-500">{enumLabel("warmupStatus", d.warmupStatus)}</td>
                <td className="num">{d.antalIndbakker}</td>
                <td className="num">{formatNumber(d.dagligSendekapacitet)}</td>
                <td className={`num ${d.bounceRate7d >= dataset.settings.alarmTærskler.bounceRateKritiskProcent ? "font-semibold text-status-crit" : d.bounceRate7d >= dataset.settings.alarmTærskler.bounceRateAdvarselProcent ? "text-status-warn" : ""}`}>
                  {formatPercent(d.bounceRate7d / 100, 1)}
                </td>
                <td className="num">{d.spamklager}</td>
                <td className="text-ink-500">{formatDateDa(d.oprettet)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
