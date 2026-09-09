import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

export const DATA_DIR = join(process.cwd(), "data");

export function readJsonFile<T>(file: string): T {
  const path = join(DATA_DIR, file);
  if (!existsSync(path)) throw new Error(`Datafil mangler: ${file}`);
  const raw = readFileSync(path, "utf-8");
  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    throw new Error(`Kunne ikke læse ${file} — ugyldig JSON: ${(err as Error).message}`);
  }
}

export function writeJsonFile(file: string, data: unknown): void {
  const path = join(DATA_DIR, file);
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

export function newId(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function nowIso(): string {
  return new Date().toISOString();
}
