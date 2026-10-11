import { normalize, uid } from "../format";
import type { InvoiceLine, Training, TrainingSession } from "../types";
import { audit, fail, must, nextCode, notify, produce, requireRole, type Service } from "./core";
import { buildInvoice } from "./invoicesService";

export type SessionInput = Pick<TrainingSession, "trainingId" | "title" | "description" | "startDate" | "endDate" | "location" | "modality" | "capacity" | "trainers" | "price">;

export const createTraining: Service<Omit<Training, "id" | "code">, string> = (db, ctx, input) =>
  produce(db, (d) => {
    if (!input.title.trim()) fail("Intitulé requis.");
    const id = uid("trn");
    const code = `FOR-${String(d.trainings.length + 1).padStart(3, "0")}`;
    d.trainings.push({ ...input, id, code });
    return { message: `Formation ${code} ajoutée au catalogue.`, data: id };
  });

export const createSession: Service<SessionInput, string> = (db, ctx, input) =>
  produce(db, (d) => {
    requireRole(ctx, ["dg", "accueil"], "gestion des formations");
    if (!input.title.trim()) fail("Titre requis.");
    if (!(input.capacity > 0)) fail("Capacité invalide.");
    if (input.endDate < input.startDate) fail("Dates incohérentes.");
    const id = uid("ses");
    const code = nextCode(d, "session", "SES");
    d.sessions.unshift({ ...input, id, code, participants: [], status: "planifiee", history: [{ date: ctx.now, userId: ctx.user.id, action: "Session créée" }] });
    return { message: `Session ${code} créée.`, data: id };
  });

export const updateSession: Service<{ id: string; patch: Partial<SessionInput> & { status?: TrainingSession["status"] } }> = (db, ctx, { id, patch }) =>
  produce(db, (d) => {
    const s = must(d.sessions.find((x) => x.id === id));
    if (patch.capacity !== undefined && patch.capacity < s.participants.length) fail(`Capacité inférieure au nombre d'inscrits (${s.participants.length}).`);
    Object.assign(s, patch);
    s.history.push({ date: ctx.now, userId: ctx.user.id, action: patch.status ? `Statut : ${patch.status}` : "Session modifiée" });
    return { message: "Session mise à jour." };
  });

/** Inscription : participant ≠ payeur ; doublons et dépassement de capacité bloqués et signalés. */
export const registerParticipant: Service<{ sessionId: string; name: string; phone: string; payerClientId: string }> = (db, ctx, input) =>
  produce(db, (d) => {
    const s = must(d.sessions.find((x) => x.id === input.sessionId));
    if (s.status === "annulee" || s.status === "terminee") fail("Session close aux inscriptions.");
    if (!input.name.trim()) fail("Nom du participant requis.");
    must(d.clients.find((c) => c.id === input.payerClientId), "Client payeur requis.");
    const key = normalize(input.name) + "|" + input.phone.replace(/\D/g, "");
    if (s.participants.some((p) => normalize(p.name) + "|" + p.phone.replace(/\D/g, "") === key || (input.phone.replace(/\D/g, "").length >= 8 && p.phone.replace(/\D/g, "") === input.phone.replace(/\D/g, ""))))
      fail("Doublon : ce participant est déjà inscrit à cette session.");
    if (s.participants.length >= s.capacity) {
      s.history.push({ date: ctx.now, userId: ctx.user.id, action: `Tentative de dépassement de capacité (${input.name})` });
      fail(`Capacité maximale atteinte (${s.capacity}). Inscription refusée et tentative signalée.`);
    }
    s.participants.push({ id: uid("par"), name: input.name, phone: input.phone, payerClientId: input.payerClientId, registeredAt: ctx.now, attendance: {} });
    s.history.push({ date: ctx.now, userId: ctx.user.id, action: `Inscription : ${input.name}` });
    if (s.participants.length === s.capacity) {
      s.status = "complete";
      notify(d, ctx, { title: "Session complète", body: `${s.code} a atteint sa capacité.`, level: "info", link: `/formations/${s.id}` });
    }
    return { message: "Participant inscrit." };
  });

/** Trace une tentative de dépassement de capacité (journal + notification). */
export const signalCapacityAttempt: Service<{ sessionId: string; name: string }> = (db, ctx, input) =>
  produce(db, (d) => {
    const s = must(d.sessions.find((x) => x.id === input.sessionId));
    s.history.push({ date: ctx.now, userId: ctx.user.id, action: `Tentative de dépassement de capacité refusée (${input.name || "participant"})` });
    notify(d, ctx, { title: "Dépassement de capacité", body: `${s.code} : tentative d'inscription au-delà de ${s.capacity} places.`, level: "alerte", link: `/formations/${s.id}` });
    audit(d, ctx, { module: "Formations", action: "Tentative de dépassement de capacité", target: s.code, newValue: input.name, decision: "Refusée" });
  });

export const removeParticipant: Service<{ sessionId: string; participantId: string }> = (db, ctx, input) =>
  produce(db, (d) => {
    const s = must(d.sessions.find((x) => x.id === input.sessionId));
    const p = must(s.participants.find((x) => x.id === input.participantId));
    if (p.invoiceId) fail("Participant déjà facturé : émettez un avoir avant de le retirer.");
    s.participants = s.participants.filter((x) => x.id !== p.id);
    if (s.status === "complete") s.status = "ouverte";
    s.history.push({ date: ctx.now, userId: ctx.user.id, action: `Désinscription : ${p.name}` });
    return { message: "Participant retiré." };
  });

export const toggleAttendance: Service<{ sessionId: string; participantId: string; date: string }> = (db, ctx, input) =>
  produce(db, (d) => {
    const s = must(d.sessions.find((x) => x.id === input.sessionId));
    const p = must(s.participants.find((x) => x.id === input.participantId));
    p.attendance[input.date] = !p.attendance[input.date];
  });

/** Facturation des participants d'un même payeur via le module financier commun. */
export const invoiceSessionPayer: Service<{ sessionId: string; payerClientId: string }, string> = (db, ctx, input) =>
  produce(db, (d) => {
    const s = must(d.sessions.find((x) => x.id === input.sessionId));
    const toBill = s.participants.filter((p) => p.payerClientId === input.payerClientId && !p.invoiceId);
    if (!toBill.length) fail("Aucun participant non facturé pour ce payeur.");
    const lines: InvoiceLine[] = [{ id: uid("il"), label: `Formation : ${s.title} (${toBill.map((p) => p.name).join(", ")})`, kind: "service", qty: toBill.length, unitPrice: s.price, discountPct: 0, source: { kind: "formation", id: s.id, label: s.code } }];
    const invId = buildInvoice(d, ctx, { clientId: input.payerClientId, lines, notes: `Session ${s.code}` });
    toBill.forEach((p) => (p.invoiceId = invId));
    audit(d, ctx, { module: "Formations", action: "Facturation de participants", target: s.code, newValue: `${toBill.length} participant(s)` });
    return { message: `Facture brouillon créée pour ${toBill.length} participant(s).`, data: invId };
  });
