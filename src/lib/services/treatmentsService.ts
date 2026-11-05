import { uid } from "../format";
import { courseEnd } from "../treatments";
import type { DoseLog, EvolutionNote, TreatmentCourse } from "../types";
import { audit, fail, must, nextCode, notify, produce, type Service } from "./core";

export type TreatmentInput = Pick<TreatmentCourse, "patientId" | "setting" | "hospitalizationId" | "consultationId" | "label" | "productId" | "dose" | "route" | "slots" | "startDate" | "days" | "vetId" | "responsibleId" | "instructions">;

export const createTreatment: Service<TreatmentInput, string> = (db, ctx, input) =>
  produce(db, (d) => {
    if (!input.label.trim()) fail("Médicament ou soin requis.");
    if (!input.slots.length) fail("Au moins un horaire de prise.");
    if (!(input.days >= 1 && input.days <= 120)) fail("Durée entre 1 et 120 jours.");
    const p = must(d.patients.find((x) => x.id === input.patientId), "Patient introuvable.");
    if (input.setting === "hospitalisation") {
      const h = must(d.hospitalizations.find((x) => x.id === input.hospitalizationId), "Choisissez le séjour d'hospitalisation.");
      if (h.patientId !== p.id) fail("Le séjour ne correspond pas au patient.");
    }
    const id = uid("trt");
    const code = nextCode(d, "trt", "TRT");
    d.treatments = d.treatments ?? [];
    d.treatments.unshift({ ...input, slots: [...input.slots].sort(), id, code, clientId: p.ownerId, status: "actif", doses: [], evolution: [], createdAt: ctx.now });
    audit(d, ctx, { module: "Traitements", action: "Mise en place", target: `${code} — ${input.label}` });
    return { message: `Traitement ${code} mis en place.`, data: id };
  });

const getCourse = (d: Parameters<Service<unknown>>[0], id: string) => must((d.treatments ?? []).find((x) => x.id === id), "Traitement introuvable.");

export interface DoseInput {
  courseId: string;
  day: string;
  slot: string;
  status: DoseLog["status"];
  by: DoseLog["by"];
  channel?: DoseLog["channel"];
  note?: string;
}

function putDose(c: TreatmentCourse, userId: string, now: string, x: Omit<DoseInput, "courseId">) {
  if (x.day < c.startDate || x.day > courseEnd(c)) fail("Date hors de la période du traitement.");
  if (!c.slots.includes(x.slot)) fail("Horaire inconnu pour ce traitement.");
  if ((x.status === "manque" || x.status === "refuse") && !x.note?.trim()) fail("Précisez la raison de la prise manquée.");
  const log: DoseLog = { id: uid("dose"), day: x.day, slot: x.slot, status: x.status, by: x.by, userId, at: now, channel: x.channel, note: x.note?.trim() || undefined };
  const i = c.doses.findIndex((g) => g.day === x.day && g.slot === x.slot);
  if (i >= 0) c.doses[i] = log;
  else c.doses.push(log);
}

/** Une prise : faite par l'équipe en clinique, ou confirmée par le propriétaire. */
export const logDose: Service<DoseInput> = (db, ctx, input) =>
  produce(db, (d) => {
    const c = getCourse(d, input.courseId);
    if (c.status !== "actif") fail("Traitement terminé ou arrêté.");
    putDose(c, ctx.user.id, ctx.now, input);
    if (input.by === "proprietaire" && input.channel && input.channel !== "sur_place") {
      d.interactions.unshift({ id: uid("int"), clientId: c.clientId, date: ctx.now, channel: input.channel === "visite" ? "visite" : input.channel, summary: `Suivi traitement ${c.code} (${c.label}) : prise du ${input.day} ${input.slot} ${input.status === "donne" ? "confirmée" : "non faite"}${input.note ? ` — ${input.note}` : ""}`, userId: ctx.user.id, simulated: false });
    }
    return { message: input.status === "donne" ? "Prise enregistrée." : "Prise manquée enregistrée." };
  });

/** Le propriétaire confirme (ou non) toutes les prises d'une journée en un seul contact. */
export const logDay: Service<Omit<DoseInput, "slot"> & { slots?: string[] }> = (db, ctx, input) =>
  produce(db, (d) => {
    const c = getCourse(d, input.courseId);
    if (c.status !== "actif") fail("Traitement terminé ou arrêté.");
    for (const slot of input.slots ?? c.slots) putDose(c, ctx.user.id, ctx.now, { ...input, slot });
    if (input.by === "proprietaire" && input.channel && input.channel !== "sur_place") {
      d.interactions.unshift({ id: uid("int"), clientId: c.clientId, date: ctx.now, channel: input.channel === "visite" ? "visite" : input.channel, summary: `Suivi traitement ${c.code} (${c.label}) : journée du ${input.day} ${input.status === "donne" ? "confirmée" : "non suivie"}${input.note ? ` — ${input.note}` : ""}`, userId: ctx.user.id, simulated: false });
    }
    return { message: "Journée enregistrée." };
  });

export const addEvolution: Service<{ courseId: string; trend: EvolutionNote["trend"]; text: string; source: EvolutionNote["source"] }> = (db, ctx, input) =>
  produce(db, (d) => {
    const c = getCourse(d, input.courseId);
    if (!input.text.trim()) fail("Décrivez l'évolution.");
    c.evolution.push({ id: uid("evo"), date: ctx.now, trend: input.trend, text: input.text.trim(), source: input.source, userId: ctx.user.id });
    if (input.trend === "aggravation") notify(d, ctx, { title: `Aggravation — ${c.label}`, body: `Évolution défavorable signalée sur le traitement ${c.code}.`, level: "alerte", link: "/traitements" });
    if (input.trend === "gueri") c.status = "termine";
    return { message: "Évolution enregistrée." };
  });

export const stopTreatment: Service<{ courseId: string; status: "termine" | "arrete"; reason: string }> = (db, ctx, input) =>
  produce(db, (d) => {
    const c = getCourse(d, input.courseId);
    if (input.status === "arrete" && !input.reason.trim()) fail("Motif d'arrêt requis.");
    c.status = input.status;
    c.stopReason = input.reason.trim() || undefined;
    audit(d, ctx, { module: "Traitements", action: input.status === "arrete" ? "Arrêt" : "Fin", target: c.code });
    return { message: input.status === "arrete" ? "Traitement arrêté." : "Traitement terminé." };
  });
