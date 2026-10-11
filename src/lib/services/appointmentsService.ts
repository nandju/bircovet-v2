import { formatDateTime, uid } from "../format";
import type { Appointment, DemoDB, QueueStatus, Reminder } from "../types";
import { audit, fail, must, produce, type Service } from "./core";

export interface AppointmentInput {
  establishmentId: string;
  clientId: string;
  patientId?: string;
  practitionerId: string;
  start: string;
  durationMin: number;
  reason: string;
  resource: string;
  reminder: Reminder;
}

const toMs = (iso: string) => new Date(iso).getTime();

export interface Conflict {
  kind: "praticien" | "ressource" | "indisponibilite";
  label: string;
}

/** Détection des chevauchements de créneaux (praticien, ressource, indisponibilités). */
export function findConflicts(db: DemoDB, a: Pick<AppointmentInput, "practitionerId" | "start" | "durationMin" | "resource" | "establishmentId">, ignoreId?: string): Conflict[] {
  const s = toMs(a.start);
  const e = s + a.durationMin * 60000;
  const out: Conflict[] = [];
  for (const x of db.appointments) {
    if (x.id === ignoreId || x.status === "annule") continue;
    const xs = toMs(x.start);
    const xe = xs + x.durationMin * 60000;
    if (xs < e && s < xe) {
      if (x.practitionerId === a.practitionerId) out.push({ kind: "praticien", label: `Praticien déjà occupé (${formatDateTime(x.start)} — ${x.reason})` });
      else if (a.resource && x.resource === a.resource && x.establishmentId === a.establishmentId)
        out.push({ kind: "ressource", label: `Ressource « ${a.resource} » déjà réservée (${formatDateTime(x.start)})` });
    }
  }
  for (const u of db.unavailabilities) {
    if (u.userId === a.practitionerId && toMs(u.start) < e && s < toMs(u.end)) out.push({ kind: "indisponibilite", label: `Indisponibilité : ${u.reason}` });
  }
  return out;
}

function validate(i: AppointmentInput) {
  if (!i.clientId) fail("Client requis.");
  if (!i.practitionerId) fail("Intervenant requis.");
  if (!i.start) fail("Date et heure requises.");
  if (!(i.durationMin >= 5)) fail("Durée de créneau invalide.");
  if (!i.reason.trim()) fail("Motif requis.");
}

export const createAppointment: Service<{ input: AppointmentInput; force?: boolean }, string> = (db, ctx, { input, force }) =>
  produce(db, (d) => {
    validate(input);
    const conflicts = findConflicts(d, input);
    if (conflicts.length && !force) fail(`Conflit de créneau : ${conflicts.map((c) => c.label).join(" ; ")}`);
    const id = uid("apt");
    d.appointments.push({
      ...input,
      id,
      status: "planifie",
      queueStatus: "attendu",
      history: [{ date: ctx.now, userId: ctx.user.id, action: conflicts.length ? "Rendez-vous créé malgré un conflit signalé" : "Rendez-vous créé" }],
    });
    audit(d, ctx, { module: "Agenda", action: "Création de rendez-vous", target: `${formatDateTime(input.start)} — ${input.reason}` });
    return { message: "Rendez-vous créé.", data: id };
  });

export const updateAppointment: Service<{ id: string; input: AppointmentInput; reason?: string; force?: boolean }> = (db, ctx, { id, input, reason, force }) =>
  produce(db, (d) => {
    validate(input);
    const a = must(d.appointments.find((x) => x.id === id));
    if (a.status === "annule" || a.status === "honore") fail("Ce rendez-vous ne peut plus être modifié.");
    const conflicts = findConflicts(d, input, id);
    if (conflicts.length && !force) fail(`Conflit de créneau : ${conflicts.map((c) => c.label).join(" ; ")}`);
    const moved = a.start !== input.start || a.practitionerId !== input.practitionerId;
    const old = formatDateTime(a.start);
    Object.assign(a, input);
    a.history.push({ date: ctx.now, userId: ctx.user.id, action: moved ? `Déplacé (${old} → ${formatDateTime(input.start)})${reason ? ` — ${reason}` : ""}` : "Modifié" });
    if (moved) audit(d, ctx, { module: "Agenda", action: "Déplacement de rendez-vous", target: a.reason, oldValue: old, newValue: formatDateTime(input.start), reason });
    return { message: moved ? "Rendez-vous déplacé." : "Rendez-vous mis à jour." };
  });

export const cancelAppointment: Service<{ id: string; reason: string }> = (db, ctx, { id, reason }) =>
  produce(db, (d) => {
    if (!reason.trim()) fail("Le motif d'annulation est obligatoire.");
    const a = must(d.appointments.find((x) => x.id === id));
    if (a.status === "honore") fail("Un rendez-vous honoré ne peut pas être annulé.");
    a.status = "annule";
    a.queueStatus = "annule";
    a.cancelReason = reason;
    a.history.push({ date: ctx.now, userId: ctx.user.id, action: `Annulé — ${reason}` });
    audit(d, ctx, { module: "Agenda", action: "Annulation de rendez-vous", target: `${formatDateTime(a.start)} — ${a.reason}`, reason });
    return { message: "Rendez-vous annulé." };
  });

export const confirmAppointment: Service<{ id: string }> = (db, ctx, { id }) =>
  produce(db, (d) => {
    const a = must(d.appointments.find((x) => x.id === id));
    if (a.status !== "planifie") fail("Seul un rendez-vous planifié peut être confirmé.");
    a.status = "confirme";
    a.history.push({ date: ctx.now, userId: ctx.user.id, action: "Confirmé par le client" });
    return { message: "Rendez-vous confirmé." };
  });

const QUEUE_FLOW: Record<QueueStatus, QueueStatus[]> = {
  attendu: ["arrive", "annule"],
  arrive: ["regle", "en_consultation", "annule"],
  regle: ["en_consultation", "annule"],
  en_consultation: ["termine"],
  termine: [],
  annule: [],
};

export const allowedQueueTransitions = (s: QueueStatus) => QUEUE_FLOW[s];

export const setQueueStatus: Service<{ id: string; status: QueueStatus; reason?: string }> = (db, ctx, { id, status, reason }) =>
  produce(db, (d) => {
    const a = must(d.appointments.find((x) => x.id === id));
    if (!QUEUE_FLOW[a.queueStatus].includes(status)) fail("Transition de file d'attente non autorisée.");
    if (status === "annule" && !reason?.trim()) fail("Motif d'annulation requis.");
    if (a.queueStatus === "arrive" && status === "en_consultation") {
      if (ctx.user.roleId !== "dg")
        fail("Paiement préalable requis avant la prise en charge. Une exception doit être approuvée par le DG (profil DG).");
      if (!reason?.trim()) fail("Motif de l'exception au paiement préalable requis.");
      audit(d, ctx, { module: "Agenda", action: "Exception au paiement préalable", target: a.reason, reason, decision: "Approuvée par le DG" });
    }
    a.queueStatus = status;
    if (status === "arrive" || status === "en_consultation") a.status = a.status === "planifie" ? "confirme" : a.status;
    if (status === "termine") a.status = "honore";
    if (status === "annule") {
      a.status = "annule";
      a.cancelReason = reason;
    }
    a.history.push({ date: ctx.now, userId: ctx.user.id, action: `File d'attente : ${status}${reason ? ` — ${reason}` : ""}` });
    return { message: "Statut de file d'attente mis à jour." };
  });

/** Rappel SIMULÉ : aucun SMS/WhatsApp/e-mail n'est envoyé. */
export const simulateReminder: Service<{ id: string }> = (db, ctx, { id }) =>
  produce(db, (d) => {
    const a = must(d.appointments.find((x) => x.id === id));
    if (!a.reminder.enabled) fail("Rappel désactivé pour ce rendez-vous.");
    a.reminder.simulatedAt = ctx.now;
    a.history.push({ date: ctx.now, userId: ctx.user.id, action: `Rappel ${a.reminder.channel} SIMULÉ (aucun envoi réel)` });
    d.interactions.unshift({ id: uid("int"), clientId: a.clientId, date: ctx.now, channel: a.reminder.channel === "appel" ? "appel" : a.reminder.channel, summary: `Rappel de rendez-vous simulé — non envoyé`, userId: ctx.user.id, simulated: true });
    return { message: "Rappel simulé enregistré — aucun message réel n'a été envoyé." };
  });

export const addUnavailability: Service<{ userId: string; start: string; end: string; reason: string }> = (db, ctx, input) =>
  produce(db, (d) => {
    if (!input.reason.trim()) fail("Motif requis.");
    if (toMs(input.end) <= toMs(input.start)) fail("La fin doit être postérieure au début.");
    d.unavailabilities.push({ ...input, id: uid("una") });
    return { message: "Indisponibilité enregistrée." };
  });

export const removeUnavailability: Service<{ id: string }> = (db, ctx, { id }) =>
  produce(db, (d) => {
    d.unavailabilities = d.unavailabilities.filter((u) => u.id !== id);
    return { message: "Indisponibilité supprimée." };
  });

export type { Appointment };
