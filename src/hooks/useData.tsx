import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DatasetSchema, type Dataset } from "@/schema";
import { fetchDataset, createRecord, patchRecord, deleteRecord, upsertAlertState, deleteAlertState } from "@/lib/api";
import { computeAllAlerts, applyAlertState, rankAndCap, overallState, type AlertWithState } from "@/lib/alerts";
import { computeNextActions, type NextAction } from "@/lib/next-actions";
import { todayISO } from "@/lib/dates";

type CollectionName = "clients" | "prospects" | "campaigns" | "outreach" | "meetings" | "invoices" | "infrastructure" | "costs" | "tasks" | "goals" | "team";

interface DataContextValue {
  dataset: Dataset | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  create: <T extends { id: string }>(collection: CollectionName, data: Partial<T>) => Promise<T>;
  update: <T extends { id: string }>(collection: CollectionName, id: string, patch: Partial<T>) => Promise<T>;
  remove: (collection: CollectionName, id: string) => Promise<void>;
  snoozeAlert: (alarmId: string, days: number, begrundelse: string) => Promise<void>;
  unsnoozeAlert: (alarmId: string) => Promise<void>;
  alerts: { active: AlertWithState[]; snoozed: AlertWithState[]; ranked: ReturnType<typeof rankAndCap>; state: ReturnType<typeof overallState> };
  nextActions: NextAction[];
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const raw = await fetchDataset();
      const parsed = DatasetSchema.safeParse(raw);
      if (!parsed.success) {
        console.error(parsed.error);
        throw new Error("Datafilerne kunne ikke valideres. Tjek konsollen for detaljer om hvilket felt der fejler.");
      }
      setDataset(parsed.data);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = useCallback(async <T extends { id: string }>(collection: CollectionName, data: Partial<T>) => {
    const record = await createRecord<T>(collection, data);
    await load();
    return record;
  }, [load]) as DataContextValue["create"];

  const update = useCallback(async <T extends { id: string }>(collection: CollectionName, id: string, patch: Partial<T>) => {
    const record = await patchRecord<T>(collection, id, patch);
    await load();
    return record;
  }, [load]) as DataContextValue["update"];

  const remove = useCallback(async (collection: CollectionName, id: string) => {
    await deleteRecord(collection, id);
    await load();
  }, [load]);

  const snoozeAlert = useCallback(async (alarmId: string, days: number, begrundelse: string) => {
    const ref = todayISO();
    const d = new Date(ref);
    d.setDate(d.getDate() + days);
    await upsertAlertState({
      alarmId,
      udsatTil: d.toISOString().slice(0, 10),
      begrundelse,
      udsatAf: "team-azam",
      tidspunkt: new Date().toISOString(),
    });
    await load();
  }, [load]);

  const unsnoozeAlert = useCallback(async (alarmId: string) => {
    await deleteAlertState(alarmId);
    await load();
  }, [load]);

  const alerts = useMemo(() => {
    if (!dataset) {
      return { active: [], snoozed: [], ranked: rankAndCap([], 5), state: "sund" as const };
    }
    const all = computeAllAlerts(dataset);
    const { active, snoozed } = applyAlertState(all, dataset);
    const ranked = rankAndCap(active, dataset.settings.alarmVisning.maksAntalSynlige);
    return { active, snoozed, ranked, state: overallState(active) };
  }, [dataset]);

  const nextActions = useMemo(() => {
    if (!dataset) return [];
    return computeNextActions(dataset).actions;
  }, [dataset]);

  const value: DataContextValue = {
    dataset, loading, error, refetch: load, create, update, remove, snoozeAlert, unsnoozeAlert, alerts, nextActions,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData skal bruges inden i <DataProvider>");
  return ctx;
}

export function useEnumLabel() {
  const { dataset } = useData();
  return useCallback(
    (enumName: string, key: string | null | undefined): string => {
      if (!key) return "—";
      const options = dataset?.enums[enumName];
      return options?.find((o) => o.key === key)?.label ?? key;
    },
    [dataset],
  );
}
