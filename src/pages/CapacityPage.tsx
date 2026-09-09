import { useData } from "@/hooks/useData";
import { PageHeader } from "@/components/PageHeader";
import { Card, SectionTitle } from "@/components/Card";
import { MetricTile } from "@/components/MetricTile";
import { formatNumber, formatPercent } from "@/lib/format";
import { computeCapacitySummary } from "@/lib/capacity";

export default function CapacityPage() {
  const { dataset } = useData();
  if (!dataset) return null;
  const cap = computeCapacitySummary(dataset);

  const verdict = cap.extraEmailClientSlots >= 2 ? "sund" : cap.extraEmailClientSlots >= 1 ? "advarsel" : "kritisk";
  const verdictSentence =
    cap.extraEmailClientSlots >= 2
      ? `I kan tage ${formatNumber(cap.extraEmailClientSlots)} kunder mere ind med den nuværende sendekapacitet.`
      : cap.extraEmailClientSlots === 1
        ? "I kan lige akkurat tage én kunde mere ind — men uden meget margin."
        : "I kan ikke tage en ny kunde ind uden mere sendekapacitet først.";

  return (
    <div>
      <PageHeader title="Kapacitet" subtitle="Skal kunne besvares før I siger ja til en ny aftale." />

      <div className="mb-6 rounded-2xl border border-ink-100 bg-white p-5">
        <p className="font-display text-xl font-semibold text-ink-900">{verdictSentence}</p>
        <p className="mt-1 text-sm text-ink-500">
          Baseret på at en typisk kundekampagne bruger {formatNumber(cap.avgEmailPerActiveClient)} mails/dag, og der er {formatNumber(Math.max(0, cap.healthyEmailCapacity - cap.requiredEmailDaily))} mails/dag tilbage af den sunde kapacitet.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricTile
          label="Sendekapacitet i brug"
          value={formatPercent(cap.emailUtilization)}
          level={cap.emailUtilization >= 0.9 ? "kritisk" : cap.emailUtilization >= 0.75 ? "advarsel" : "sund"}
          meaning={`${formatNumber(cap.requiredEmailDaily)} af ${formatNumber(cap.healthyEmailCapacity)} mails/dag fra sunde domæner.`}
        />
        <MetricTile
          label="Plads til flere kunder (email)"
          value={formatNumber(cap.extraEmailClientSlots)}
          level={verdict}
          meaning="Ved samme forbrug pr. kunde som i dag."
        />
        <MetricTile
          label="Aktive kunder nu"
          value={formatNumber(cap.activeClientCount)}
          meaning={cap.phoneUtilizationNote}
        />
      </div>

      <Card>
        <SectionTitle>Hvad skal skaffes før næste kunde?</SectionTitle>
        {cap.extraEmailClientSlots >= 1 ? (
          <p className="text-sm text-ink-600">Sendekapaciteten rækker til mindst én kunde mere lige nu. Hold øje med bounce rate når volumen stiger — se Infrastruktur.</p>
        ) : (
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-600">
            <li>Skaf mindst ét nyt afsenderdomæne med varmede indbakker, før en ny kunde tages ind.</li>
            <li>Tjek om et brændt eller advarsel-domæne i Infrastruktur kan genoprettes for at frigive kapacitet hurtigere.</li>
          </ul>
        )}
      </Card>
    </div>
  );
}
