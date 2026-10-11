import { uid } from "../format";
import type { Interaction, MessageTemplate, Task, TaskStatus } from "../types";
import { audit, fail, must, produce, type Service } from "./core";

export type TaskInput = Pick<Task, "title" | "description" | "assigneeId" | "priority" | "dueDate" | "category" | "clientId" | "patientId">;

export const createTask: Service<TaskInput, string> = (db, ctx, input) =>
  produce(db, (d) => {
    if (!input.title.trim()) fail("Titre requis.");
    if (!input.dueDate) fail("Échéance requise.");
    const id = uid("tsk");
    d.tasks.unshift({ ...input, id, status: "a_faire", result: "", history: [{ date: ctx.now, userId: ctx.user.id, action: "Tâche créée" }] });
    return { message: "Tâche créée.", data: id };
  });

export const updateTask: Service<{ id: string; patch: Partial<TaskInput> }> = (db, ctx, { id, patch }) =>
  produce(db, (d) => {
    const t = must(d.tasks.find((x) => x.id === id));
    if (patch.dueDate && patch.dueDate !== t.dueDate) fail("Pour changer l'échéance, utilisez « Reporter » (motif et nouvelle échéance obligatoires).");
    Object.assign(t, patch);
    t.history.push({ date: ctx.now, userId: ctx.user.id, action: "Tâche modifiée" });
    return { message: "Tâche mise à jour." };
  });

export const setTaskStatus: Service<{ id: string; status: TaskStatus; result?: string }> = (db, ctx, { id, status, result }) =>
  produce(db, (d) => {
    const t = must(d.tasks.find((x) => x.id === id));
    if (status === "termine" && !result?.trim()) fail("Indiquez le résultat pour terminer la tâche.");
    t.status = status;
    if (result) t.result = result;
    t.history.push({ date: ctx.now, userId: ctx.user.id, action: `Statut : ${status}`, note: result });
    return { message: "Statut de la tâche mis à jour." };
  });

/** Report : nouvelle échéance obligatoire. */
export const postponeTask: Service<{ id: string; newDueDate: string; reason: string }> = (db, ctx, { id, newDueDate, reason }) =>
  produce(db, (d) => {
    const t = must(d.tasks.find((x) => x.id === id));
    if (!newDueDate) fail("Une nouvelle échéance est obligatoire pour reporter.");
    if (newDueDate <= t.dueDate) fail("La nouvelle échéance doit être postérieure à l'actuelle.");
    if (!reason.trim()) fail("Motif du report requis.");
    const old = t.dueDate;
    t.dueDate = newDueDate;
    if (t.status === "termine") t.status = "a_faire";
    t.history.push({ date: ctx.now, userId: ctx.user.id, action: `Reportée du ${old} au ${newDueDate}`, note: reason });
    audit(d, ctx, { module: "Relation client", action: "Report de tâche", target: t.title, oldValue: old, newValue: newDueDate, reason });
    return { message: "Tâche reportée." };
  });

export function renderTemplate(tpl: MessageTemplate, vars: Record<string, string>): string {
  return tpl.body.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}

/** Message SIMULÉ : jamais envoyé, uniquement tracé comme interaction de démonstration. */
export const logSimulatedMessage: Service<{ clientId: string; channel: Interaction["channel"]; body: string }> = (db, ctx, input) =>
  produce(db, (d) => {
    if (!input.body.trim()) fail("Message vide.");
    const c = must(d.clients.find((x) => x.id === input.clientId));
    const allowed = { sms: c.commPrefs.sms, whatsapp: c.commPrefs.whatsapp, email: c.commPrefs.email, appel: c.commPrefs.call, visite: true }[input.channel];
    if (!allowed) fail("Ce canal n'est pas autorisé dans les préférences de communication du client.");
    d.interactions.unshift({ id: uid("int"), clientId: c.id, date: ctx.now, channel: input.channel, summary: `[SIMULATION — NON ENVOYÉ] ${input.body.slice(0, 160)}`, userId: ctx.user.id, simulated: true });
    return { message: "Message simulé enregistré dans l'historique — aucun envoi réel." };
  });

export const logInteraction: Service<{ clientId: string; channel: Interaction["channel"]; summary: string }> = (db, ctx, input) =>
  produce(db, (d) => {
    if (!input.summary.trim()) fail("Résumé requis.");
    d.interactions.unshift({ id: uid("int"), clientId: input.clientId, date: ctx.now, channel: input.channel, summary: input.summary, userId: ctx.user.id, simulated: false });
    return { message: "Interaction consignée." };
  });
