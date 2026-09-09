import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useData, useEnumLabel } from "@/hooks/useData";
import { PageHeader } from "@/components/PageHeader";
import { Card, SectionTitle } from "@/components/Card";
import { StaleBadge } from "@/components/StatusPill";
import { ExportButton } from "@/components/ExportButton";
import { formatDKK, formatPercent, formatNumber } from "@/lib/format";
import { daysSince, todayISO } from "@/lib/dates";
import type { Prospect } from "@/schema";

const STAGES: Prospect["status"][] = ["ny", "kontaktet", "svar", "møde_booket", "møde_afholdt", "tilbud_sendt", "vundet", "tabt"];
const STAGE_LABEL: Record<Prospect["status"], string> = {
  ny: "Ny", kontaktet: "Kontaktet", svar: "Svar", møde_booket: "Møde booket", møde_afholdt: "Møde afholdt",
  tilbud_sendt: "Tilbud sendt", vundet: "Vundet", tabt: "Tabt",
};
const FUNNEL_STAGES: Prospect["status"][] = ["ny", "kontaktet", "svar", "møde_booket", "møde_afholdt", "tilbud_sendt", "vundet"];

export default function OwnSalesPage() {
  const { dataset, update } = useData();
  const enumLabel = useEnumLabel();
  const [params] = useSearchParams();
  const highlighted = params.get("prospect");
  const [dragging, setDragging] = useState<string | null>(null);
  const today = todayISO();

  if (!dataset) return null;
  const stalenessThreshold = dataset.settings.alarmTærskler.prospectStilstandDage;

  const byStage = useMemo(() => {
    const map = new Map<Prospect["status"], Prospect[]>();
    for (const s of STAGES) map.set(s, []);
    for (const p of dataset.prospects) map.get(p.status)!.push(p);
    return map;
  }, [dataset.prospects]);

  const funnelCounts = FUNNEL_STAGES.map((stage, i) => {
    const idx = FUNNEL_STAGES.indexOf(stage);
    const count = dataset.prospects.filter((p) => p.status !== "tabt" && FUNNEL_STAGES.indexOf(p.status) >= idx).length;
    return { stage, count };
  });

  const bySource = useMemo(() => {
    const sources = [...new Set(dataset.prospects.map((p) => p.kilde))];
    return sources.map((kilde) => {
      const rows = dataset.prospects.filter((p) => p.kilde === kilde);
      const won = rows.filter((p) => p.status === "vundet").length;
      const lost = rows.filter((p) => p.status === "tabt").length;
      const decided = won + lost;
      return { kilde, total: rows.length, won, winRate: decided > 0 ? won / decided : null };
    });
  }, [dataset.prospects]);

  const lossReasons = useMemo(() => {
    const lost = dataset.prospects.filter((p) => p.status === "tabt" && p.tabsårsag);
    const counts = new Map<string, number>();
    for (const p of lost) counts.set(p.tabsårsag!, (counts.get(p.tabsårsag!) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([key, count]) => ({ key, count, label: enumLabel("tabsårsag", key) }));
  }, [dataset.prospects, enumLabel]);

  async function moveTo(prospectId: string, status: Prospect["status"]) {
    await update<Prospect>("prospects", prospectId, { status, stadieSkiftetDato: today });
  }

  return (
    <div>
      <PageHeader
        title="Eget salg"
        subtitle="Vores egen jagt på kunder. Så længe vi har nul aktive kunder, er det her det eneste der tæller."
        action={<ExportButton rows={dataset.prospects} filename="prospects" />}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <p className="text-[13px] font-medium text-ink-500">Aktive prospects</p>
          <p className="num font-display mt-1 text-2xl font-semibold text-ink-900">
            {formatNumber(dataset.prospects.filter((p) => p.status !== "vundet" && p.status !== "tabt").length)}
          </p>
        </Card>
        <Card>
          <p className="text-[13px] font-medium text-ink-500">Vundet i alt</p>
          <p className="num font-display mt-1 text-2xl font-semibold text-status-good">{formatNumber(dataset.prospects.filter((p) => p.status === "vundet").length)}</p>
        </Card>
        <Card>
          <p className="text-[13px] font-medium text-ink-500">Tabt i alt</p>
          <p className="num font-display mt-1 text-2xl font-semibold text-status-crit">{formatNumber(dataset.prospects.filter((p) => p.status === "tabt").length)}</p>
        </Card>
        <Card>
          <p className="text-[13px] font-medium text-ink-500">Pipeline-værdi (aktiv)</p>
          <p className="num font-display mt-1 text-2xl font-semibold text-ink-900">
            {formatDKK(dataset.prospects.filter((p) => p.status !== "vundet" && p.status !== "tabt").reduce((s, p) => s + p.estimeretMånedligVærdi, 0))}
          </p>
        </Card>
      </div>

      <SectionTitle>Pipeline</SectionTitle>
      <div className="mb-8 grid grid-cols-2 gap-3 overflow-x-auto pb-2 md:grid-cols-4 lg:grid-cols-8">
        {STAGES.map((stage) => (
          <div
            key={stage}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => dragging && moveTo(dragging, stage)}
            className="flex min-h-[140px] flex-col rounded-2xl bg-ink-50 p-2"
          >
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-xs font-semibold text-ink-600">{STAGE_LABEL[stage]}</span>
              <span className="num text-xs text-ink-400">{byStage.get(stage)!.length}</span>
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              {byStage.get(stage)!.map((p) => {
                const stale = stage !== "vundet" && stage !== "tabt" && daysSince(p.stadieSkiftetDato, today) >= stalenessThreshold;
                return (
                  <div
                    key={p.id}
                    draggable
                    onDragStart={() => setDragging(p.id)}
                    onDragEnd={() => setDragging(null)}
                    className={`cursor-grab rounded-xl border bg-white p-2 text-xs shadow-sm active:cursor-grabbing ${highlighted === p.id ? "border-brand-500 ring-1 ring-brand-300" : "border-ink-100"}`}
                  >
                    <p className="font-medium text-ink-800">{p.virksomhed}</p>
                    <p className="text-ink-500">{p.kontaktperson}</p>
                    {stale && <StaleBadge className="mt-1">{daysSince(p.stadieSkiftetDato, today)}d stille</StaleBadge>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <SectionTitle>Konvertering gennem tragten</SectionTitle>
          <ul className="space-y-1.5">
            {funnelCounts.map((f, i) => {
              const prev = i > 0 ? funnelCounts[i - 1].count : null;
              const rate = prev && prev > 0 ? f.count / prev : null;
              return (
                <li key={f.stage} className="flex items-center justify-between text-sm">
                  <span className="text-ink-600">{STAGE_LABEL[f.stage]}</span>
                  <span className="num flex items-center gap-2">
                    <span className="text-ink-800">{f.count}</span>
                    {rate !== null && <span className="text-xs text-ink-400">({formatPercent(rate)})</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card className="lg:col-span-1">
          <SectionTitle>Konvertering pr. kilde</SectionTitle>
          <ul className="space-y-1.5">
            {bySource.map((s) => (
              <li key={s.kilde} className="flex items-center justify-between text-sm">
                <span className="text-ink-600">{enumLabel("prospectKilde", s.kilde)}</span>
                <span className="num flex items-center gap-2">
                  <span className="text-ink-800">{s.total}</span>
                  <span className="text-xs text-ink-400">{s.winRate !== null ? `${formatPercent(s.winRate)} vundet` : "—"}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="lg:col-span-1">
          <SectionTitle>Tabsårsager</SectionTitle>
          {lossReasons.length === 0 ? (
            <p className="text-sm text-ink-400">Ingen tabte prospects endnu.</p>
          ) : (
            <ul className="space-y-1.5">
              {lossReasons.map((r) => (
                <li key={r.key} className="flex items-center justify-between text-sm">
                  <span className="text-ink-600">{r.label}</span>
                  <span className="num text-ink-800">{r.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
