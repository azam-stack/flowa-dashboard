import type { Dataset } from "@/schema";

const BASE = "/api";

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `Fejl ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export async function fetchDataset(): Promise<Dataset> {
  const res = await fetch(`${BASE}/data`);
  return handle<Dataset>(res);
}

export async function createRecord<T>(collection: string, data: Partial<T>): Promise<T> {
  const res = await fetch(`${BASE}/${collection}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handle<T>(res);
}

export async function patchRecord<T>(collection: string, id: string, patch: Partial<T>): Promise<T> {
  const res = await fetch(`${BASE}/${collection}/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return handle<T>(res);
}

export async function deleteRecord(collection: string, id: string): Promise<void> {
  const res = await fetch(`${BASE}/${collection}/${id}`, { method: "DELETE" });
  return handle<void>(res);
}

export async function upsertAlertState(entry: {
  alarmId: string;
  udsatTil: string;
  begrundelse: string;
  udsatAf: string;
  tidspunkt: string;
}) {
  const res = await fetch(`${BASE}/alerts-state`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry),
  });
  return handle(res);
}

export async function deleteAlertState(alarmId: string) {
  const res = await fetch(`${BASE}/alerts-state/${alarmId}`, { method: "DELETE" });
  return handle(res);
}
