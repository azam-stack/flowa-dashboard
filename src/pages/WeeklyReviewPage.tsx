import { Printer } from "lucide-react";
import { useData, useEnumLabel } from "@/hooks/useData";
import { PageHeader } from "@/components/PageHeader";
import { Card, SectionTitle } from "@/components/Card";
import { formatDKK, formatNumber, formatPercent } from "@/lib/format";
import { addDaysISO, daysBetween, formatDateDa, todayISO } from "@/lib/dates";
import { meetingsCountingTowardQuota } from "@/lib/alerts";

function weekRange(ref: string, offsetWeeks: number) {
  const d = new Date(ref);
  const dow = d.getDay() === 0 ? 7 : d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - dow + 1 + offsetWeeks * 7);
  const start = monday.toISOString().slice(0, 10);
  const end = addDaysISO(start, 6);
  return { start, end };
}

export default function WeeklyReviewPage() {
  const { dataset } = useData();
  const enumLabel = useEnumLabel();
  const today = todayISO();
  if (!dataset) return null;

  const thisWeek = weekRange(today, 0);
  const lastWeek = weekRange(today, -1);
  const inRange = (date: string, range: { start: string; end: string }) => date >= range.start && date <= range.end;

  const meetingsThis = dataset.meetings.filter((m) => inRange(m.mødeDato, thisWeek) && m.status === "afholdt");
  const meetingsLast = dataset.meetings.filter((m) => inRange(m.mødeDato, lastWeek) && m.status === "afholdt");

  const perClient = dataset.clients.map((c) => ({
    client: c,
    thisWeek: meetingsThis.filter((m) => m.clientId === c.id).length,
    lastWeek: meetingsLast.filter((m) => m.clientId === c.id).length,
  })).filter((x) => x.thisWeek > 0 || x.lastWeek > 0);

  const decidedThis = dataset.meetings.filter((m) => inRange(m.godkendelseOpdateretDato, thisWeek) && (m.godkendelse === "godkendt" || m.godkendelse === "afvist"));
  const approved = decidedThis.filter((m) => m.godkendelse === "godkendt");
  const rejected = decidedThis.filter((m) => m.godkendelse === "afvist");
  const rejectionCounts = new Map<string, number>();
  for (const m of rejected) if (m.afvisningsårsag) rejectionCounts.set(m.afvisningsårsag, (rejectionCounts.get(m.afvisningsårsag) ?? 0) + 1);

  const movedProspects = dataset.prospects.filter((p) => inRange(p.stadieSkiftetDato, thisWeek));
  const won = movedProspects.filter((p) => p.status === "vundet");
  const lost = movedProspects.filter((p) => p.status === "tabt");

  const campaignDrops = dataset.campaigns.filter((c) => c.kanal === "email" && c.status === "aktiv").map((c) => {
    const rows = dataset.outreach.filter((o) => o.campaignId === c.id);
    const rate = (range: typeof thisWeek) => {
      const r = rows.filter((row) => inRange(row.dato, range));
      const sendt = r.reduce((s, x) => s + x.emailsSendt, 0);
      const pos = r.reduce((s, x) => s + x.positiveSvar, 0);
      return sendt > 0 ? pos / sendt : null;
    };
    const t = rate(thisWeek);
    const l = rate(lastWeek);
    const drop = t !== null && l !== null && l > 0 ? (1 - t / l) * 100 : null;
    return { campaign: c, thisRate: t, lastRate: l, drop };
  }).filter((x) => x.drop !== null && x.drop > 10);

  const notDone = dataset.tasks.filter((t) => t.status !== "afsluttet" && t.forfaldsdato < thisWeek.start);

  return (
    <div>
      <PageHeader
        title="Ugentlig gennemgang"
        subtitle={`${formatDateDa(thisWeek.start)} – ${formatDateDa(thisWeek.end)}`}
        action={
          <button onClick={() => window.print()} className="no-print inline-flex items-center gap-1.5 rounded-lg border border-ink-200 px-3 py-1.5 text-sm font-medium text-ink-600 hover:bg-ink-50">
            <Printer size={14} /> Udskriv
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle>Møder leveret pr. kunde</SectionTitle>
          {perClient.length === 0 ? (
            <p className="text-sm text-ink-400">Ingen møder afholdt denne eller sidste uge.</p>
          ) : (
            <ul className="space-y-1.5">
              {perClient.map((row) => (
                <li key={row.client.id} className="flex items-center justify-between text-sm">
                  <span className="text-ink-600">{row.client.navn}</span>
                  <span className="num">
                    <span className="font-semibold text-ink-900">{row.thisWeek}</span>
                    <span className="text-ink-400"> (sidste uge: {row.lastWeek})</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <SectionTitle>Godkendt og afvist</SectionTitle>
          <p className="text-sm text-ink-600">
            <span className="num font-semibold text-status-good">{approved.length}</span> godkendt · <span className="num font-semibold text-status-crit">{rejected.length}</span> afvist
          </p>
          {rejectionCounts.size > 0 && (
            <ul className="mt-2 space-y-1">
              {[...rejectionCounts.entries()].map(([reason, count]) => (
                <li key={reason} className="flex justify-between text-xs text-ink-500">
                  <span>{enumLabel("afvisningsårsag", reason)}</span>
                  <span className="num">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <SectionTitle>Prospects der rykkede stadie</SectionTitle>
          <p className="text-sm text-ink-600">{movedProspects.length} prospects rykkede sig — {won.length} vundet, {lost.length} tabt.</p>
          {won.length > 0 && <p className="mt-1 text-xs text-status-good">Vundet: {won.map((p) => p.virksomhed).join(", ")}</p>}
          {lost.length > 0 && <p className="mt-1 text-xs text-status-crit">Tabt: {lost.map((p) => p.virksomhed).join(", ")}</p>}
        </Card>

        <Card>
          <SectionTitle>Kampagner der faldt</SectionTitle>
          {campaignDrops.length === 0 ? (
            <p className="text-sm text-ink-400">Ingen kampagner faldt markant denne uge.</p>
          ) : (
            <ul className="space-y-1.5">
              {campaignDrops.map(({ campaign, drop }) => (
                <li key={campaign.id} className="text-sm text-ink-600">
                  {campaign.navn}: <span className="num font-semibold text-status-crit">-{formatNumber(drop!)}%</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <SectionTitle>Hvad blev ikke lavet</SectionTitle>
          {notDone.length === 0 ? (
            <p className="text-sm text-ink-400">Ingenting hænger — alt forfaldent fra før denne uge er lukket.</p>
          ) : (
            <ul className="list-disc space-y-1 pl-5 text-sm text-ink-600">
              {notDone.map((t) => (
                <li key={t.id}>{t.titel} <span className="text-xs text-ink-400">(forfaldt {formatDateDa(t.forfaldsdato)})</span></li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
