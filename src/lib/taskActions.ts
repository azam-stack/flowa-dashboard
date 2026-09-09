import type { FlowaTask } from "@/schema";
import { addDaysISO, todayISO } from "./dates";

export function nextDueDate(fromISO: string, gentagelse: NonNullable<FlowaTask["gentagelse"]>): string {
  switch (gentagelse) {
    case "daglig":
      return addDaysISO(fromISO, 1);
    case "ugentlig":
      return addDaysISO(fromISO, 7);
    case "månedlig":
      return addDaysISO(fromISO, 30);
  }
}

/** Completing a recurring task creates its next occurrence automatically. */
export async function completeTask(
  task: FlowaTask,
  update: (col: "tasks", id: string, patch: Partial<FlowaTask>) => Promise<FlowaTask>,
  create: (col: "tasks", data: Partial<FlowaTask>) => Promise<FlowaTask>,
) {
  await update("tasks", task.id, { status: "afsluttet" });
  if (task.gentagelse) {
    await create("tasks", {
      titel: task.titel,
      beskrivelse: task.beskrivelse,
      forfaldsdato: nextDueDate(task.forfaldsdato, task.gentagelse),
      prioritet: task.prioritet,
      status: "åben",
      knyttetTil: task.knyttetTil,
      gentagelse: task.gentagelse,
      ownerId: task.ownerId,
      oprettetDato: todayISO(),
    });
  }
}
