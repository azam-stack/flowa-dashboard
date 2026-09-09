import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, AlertTriangle, AlertOctagon, ChevronDown } from "lucide-react";
import { useState } from "react";
import { useData } from "@/hooks/useData";
import { AlertLine } from "@/components/AlertLine";
import { NextActionItem } from "@/components/NextActionItem";
import { Card, SectionTitle } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { Blob } from "@/components/Blob";
import { systemChecks } from "@/lib/alerts";
import { formatDateDa, todayISO } from "@/lib/dates";
import { StatusPill } from "@/components/StatusPill";

const STATE_COPY = {
  kritisk: { icon: AlertOctagon, text: "kræver handling nu", tone: "text-status-crit" },
  advarsel: { icon: AlertTriangle, text: "bør håndteres", tone: "text-status-warn" },
  sund: { icon: CheckCircle2, text: "alt sundt", tone: "text-status-good" },
} as const;

export default function TodayPage() {
  const { dataset, alerts, nextActions } = useData();
  const navigate = useNavigate();
  const [showAll, setShowAll] = useState(false);
  if (!dataset) return null;

  const hasClients = dataset.clients.some((c) => c.status === "aktiv" || c.status === "onboarding");
  const today = todayISO();
  const cfg = STATE_COPY[alerts.state];
  const Icon = cfg.icon;

  const visible = showAll ? alerts.active : alerts.ranked.visible;
  const hiddenCount = showAll ? 0 : alerts.ranked.skjulteAntal;

  const todaysMeetings = dataset.meetings.filter((m) => m.mødeDato === today && m.status === "planlagt");
  const todaysTasks = dataset.tasks.filter((t) => t.forfaldsdato === today && t.status !== "afsluttet");

  const stateSentence = hasClients
    ? alerts.state === "kritisk"
      ? `${alerts.active.filter((a) => a.niveau === "kritisk").length} kritiske forhold i leveringen kræver handling nu.`
      : alerts.state === "advarsel"
        ? `${alerts.active.length} forhold bør håndteres — hold øje med leveringstempoet.`
        : "Leveringen kører efter planen hos alle aktive kunder."
    : alerts.state === "kritisk"
      ? `${alerts.active.filter((a) => a.niveau === "kritisk").length} kritiske forhold i eget salg kræver handling nu.`
      : alerts.state === "advarsel"
        ? `${alerts.active.length} forhold i eget salg bør håndteres i dag.`
        : "Eget salg kører fint. Ingenting brænder.";

  return (
    <div>
      <PageHeader
        title="I dag"
        subtitle={hasClients ? "Levering har forrang, mens I har kunder i systemet." : "Flowas eget salg er det eneste der tæller, indtil den første kunde er landet."}
      />

      {/* LAG 1 — tilstanden */}
      <div className={`mb-6 flex items-center gap-3 rounded-2xl border border-ink-100 bg-white px-5 py-4`}>
        <Icon className={cfg.tone} size={26} strokeWidth={2.2} />
        <div>
          <p className="font-display text-xl font-semibold text-ink-900">{stateSentence}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* LAG 2 — alarmer */}
        <div className="lg:col-span-3">
          <SectionTitle>Alarmer</SectionTitle>
          {alerts.active.length === 0 ? (
            <GreenState />
          ) : (
            <div className="space-y-2.5">
              {visible.map((a) => (
                <AlertLine key={a.id} alert={a} />
              ))}
              {hiddenCount > 0 && (
                <button
                  onClick={() => setShowAll(true)}
                  className="flex w-full items-center justify-center gap-1 rounded-xl border border-dashed border-ink-200 py-2.5 text-sm text-ink-500 hover:bg-ink-50"
                >
                  og {hiddenCount} mere <ChevronDown size={14} />
                </button>
              )}
              {alerts.snoozed.length > 0 && (
                <p className="pt-1 text-xs text-ink-400">{alerts.snoozed.length} alarm(er) er udsat og vises ikke her.</p>
              )}
            </div>
          )}
        </div>

        {/* LAG 3 — næste bedste handling */}
        <div className="lg:col-span-2">
          <SectionTitle>Næste bedste handling</SectionTitle>
          {nextActions.length === 0 ? (
            <Card className="text-sm text-ink-500">Ingen forfaldne handlinger lige nu. Godt gået.</Card>
          ) : (
            <ol className="space-y-2">
              {nextActions.map((a, i) => (
                <NextActionItem key={a.id} index={i + 1} action={a} />
              ))}
            </ol>
          )}
        </div>
      </div>

      {/* below the fold — today's meetings & tasks */}
      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <SectionTitle action={<button onClick={() => navigate("/mødekvalitet")} className="text-xs font-medium text-brand-800 hover:underline">Se alle</button>}>
            Dagens møder
          </SectionTitle>
          {todaysMeetings.length === 0 ? (
            <p className="text-sm text-ink-400">Ingen planlagte møder i dag.</p>
          ) : (
            <ul className="space-y-2">
              {todaysMeetings.map((m) => {
                const client = dataset.clients.find((c) => c.id === m.clientId);
                return (
                  <li key={m.id} className="flex items-center justify-between rounded-lg border border-ink-100 px-3 py-2 text-sm">
                    <span className="text-ink-800">{m.prospectNavn} · {m.virksomhed}</span>
                    <span className="text-xs text-ink-400">{client?.navn ?? "Eget salg"}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <Card>
          <SectionTitle action={<button onClick={() => navigate("/tasks")} className="text-xs font-medium text-brand-800 hover:underline">Se alle</button>}>
            Dagens tasks
          </SectionTitle>
          {todaysTasks.length === 0 ? (
            <p className="text-sm text-ink-400">Ingen tasks forfalder i dag.</p>
          ) : (
            <ul className="space-y-2">
              {todaysTasks.map((t) => (
                <li key={t.id} className="flex items-center justify-between rounded-lg border border-ink-100 px-3 py-2 text-sm">
                  <span className="text-ink-800">{t.titel}</span>
                  <span className="text-xs capitalize text-ink-400">{t.prioritet}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function GreenState() {
  const { dataset } = useData();
  const checks = useMemo(() => (dataset ? systemChecks(dataset) : []), [dataset]);
  return (
    <Card className="relative overflow-hidden">
      <Blob className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 text-brand-50" />
      <div className="relative">
        <p className="mb-3 text-sm text-ink-600">Systemet har tjekket alt og intet kræver handling lige nu:</p>
        <ul className="space-y-2">
          {checks.map((c) => (
            <li key={c.label} className="flex items-start justify-between gap-3 rounded-lg border border-ink-100 px-3 py-2 text-sm">
              <div>
                <p className="font-medium text-ink-800">{c.label}</p>
                <p className="text-xs text-ink-500">{c.detalje}</p>
              </div>
              <StatusPill level={c.status} />
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-ink-400">Sidst tjekket {formatDateDa(todayISO())}.</p>
      </div>
    </Card>
  );
}
