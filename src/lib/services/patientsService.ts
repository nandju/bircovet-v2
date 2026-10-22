import { uid } from "../format";
import type { Patient, Vaccination, Vital } from "../types";
import { audit, fail, must, nextCode, produce, requireOnline, requireRole, type Service } from "./core";
import { queueIfOffline } from "./syncService";

export type PatientInput = Pick<
  Patient,
  "name" | "species" | "breed" | "sex" | "birthDate" | "birthDateEstimated" | "chip" | "passport" | "insurance" | "color" | "ownerId" | "allergies" | "alerts"
> & { initialWeight?: number };

function validate(p: Pick<Patient, "name" | "species" | "ownerId" | "birthDate">) {
  if (!p.name.trim()) fail("Le nom de l'animal est obligatoire.");
  if (!p.species) fail("L'espèce est obligatoire.");
  if (!p.ownerId) fail("Le propriétaire est obligatoire.");
  if (!p.birthDate) fail("La date de naissance (exacte ou estimée) est obligatoire.");
}

export const createPatient: Service<PatientInput, string> = (db, ctx, input) =>
  produce(db, (d) => {
    validate(input);
    must(d.clients.find((c) => c.id === input.ownerId && c.status === "actif"), "Propriétaire introuvable ou archivé.");
    const id = uid("pat");
    const code = nextCode(d, "patient", "PAT");
    const { initialWeight, ...rest } = input;
    d.patients.unshift({
      ...rest,
      id,
      code,
      ownerHistory: [{ clientId: input.ownerId, from: ctx.now.slice(0, 10), reason: "Premier enregistrement" }],
      vitalStatus: "vivant",
      vitals: initialWeight ? [{ id: uid("vit"), date: ctx.now, weightKg: initialWeight, authorId: ctx.user.id }] : [],
      vaccinations: [],
      notes: [],
      photos: [],
      exams: [],
      archived: false,
      createdAt: ctx.now.slice(0, 10),
    });
    audit(d, ctx, { module: "Patients", action: "Création", target: `${code} — ${input.name}` });
    return { message: `Patient ${code} enregistré.`, data: id };
  });

export const updatePatient: Service<{ id: string; patch: Partial<Omit<PatientInput, "ownerId">> }> = (db, ctx, { id, patch }) =>
  produce(db, (d) => {
    const p = must(d.patients.find((x) => x.id === id));
    if (p.vitalStatus === "decede") fail("Dossier d'un animal décédé : modification verrouillée dans la démonstration.");
    const { initialWeight: _w, ...rest } = patch;
    void _w;
    Object.assign(p, rest);
    validate(p);
    audit(d, ctx, { module: "Patients", action: "Modification", target: `${p.code} — ${p.name}` });
    return { message: "Fiche patient enregistrée." };
  });

export const addVital: Service<{ patientId: string; vital: Omit<Vital, "id" | "authorId" | "date"> & { date?: string } }> = (db, ctx, { patientId, vital }) =>
  produce(db, (d) => {
    const p = must(d.patients.find((x) => x.id === patientId));
    if (!(vital.weightKg > 0)) fail("Le poids doit être positif.");
    p.vitals.push({ ...vital, id: uid("vit"), date: vital.date || ctx.now, authorId: ctx.user.id });
    p.vitals.sort((a, b) => a.date.localeCompare(b.date));
    return { message: "Constantes enregistrées (datées et attribuées)." };
  });

export const addVaccination: Service<{ patientId: string; vac: Omit<Vaccination, "id" | "authorId"> }> = (db, ctx, { patientId, vac }) =>
  produce(db, (d) => {
    requireRole(ctx, ["dg", "vet", "assistant"], "enregistrement de vaccination");
    const p = must(d.patients.find((x) => x.id === patientId));
    if (!vac.name.trim()) fail("Nom du vaccin requis.");
    p.vaccinations.unshift({ ...vac, id: uid("vac"), authorId: ctx.user.id });
    return { message: vac.nextDue ? "Vaccination enregistrée ; rappel configuré à la date saisie." : "Vaccination enregistrée (aucun rappel automatique)." };
  });

export const addPatientNote: Service<{ patientId: string; text: string }> = (db, ctx, { patientId, text }) =>
  produce(db, (d) => {
    if (!text.trim()) fail("La note est vide.");
    const p = must(d.patients.find((x) => x.id === patientId));
    const noteId = uid("note");
    p.notes.unshift({ id: noteId, text, authorId: ctx.user.id, date: ctx.now, syncStatus: ctx.offline ? "en_attente" : "synchronise" });
    queueIfOffline(d, ctx, "note_patient", { kind: "patient", id: patientId }, text, `Note patient ${p.code} — ${p.name}`, noteId);
    return { message: ctx.offline ? "Note enregistrée localement — en attente de synchronisation." : "Note ajoutée au dossier." };
  });

/** Cession : l'historique est conservé, les dettes antérieures restent à l'ancien propriétaire. */
export const transferOwnership: Service<{ patientId: string; newOwnerId: string; reason: string; date: string }> = (db, ctx, input) =>
  produce(db, (d) => {
    requireOnline(ctx, "Cession de propriété");
    const p = must(d.patients.find((x) => x.id === input.patientId));
    if (input.newOwnerId === p.ownerId) fail("Le nouveau propriétaire est identique à l'actuel.");
    if (!input.reason.trim()) fail("Motif de cession requis.");
    const newOwner = must(d.clients.find((c) => c.id === input.newOwnerId), "Nouveau propriétaire introuvable.");
    const current = p.ownerHistory.find((h) => !h.to);
    if (current) current.to = input.date;
    const oldOwnerId = p.ownerId;
    p.ownerHistory.push({ clientId: input.newOwnerId, from: input.date, reason: input.reason });
    p.ownerId = input.newOwnerId;
    audit(d, ctx, {
      module: "Patients",
      action: "Cession de propriété",
      target: `${p.code} — ${p.name}`,
      oldValue: d.clients.find((c) => c.id === oldOwnerId)?.name,
      newValue: newOwner.name,
      reason: `${input.reason} — dettes antérieures NON transférées`,
    });
    return { message: "Cession enregistrée. L'historique est conservé ; les dettes antérieures restent attribuées à l'ancien propriétaire." };
  });

/** Déclaration de décès : confirmation explicite + trace au journal. */
export const declareDeath: Service<{ patientId: string; date: string; reason: string; confirm: string }> = (db, ctx, input) =>
  produce(db, (d) => {
    requireRole(ctx, ["dg", "vet"], "déclaration de décès");
    const p = must(d.patients.find((x) => x.id === input.patientId));
    if (input.confirm.trim().toUpperCase() !== p.name.trim().toUpperCase()) fail("Confirmation incorrecte : saisissez exactement le nom de l'animal.");
    if (!input.reason.trim()) fail("Le motif est obligatoire.");
    if (p.vitalStatus === "decede") fail("Le décès est déjà enregistré.");
    p.vitalStatus = "decede";
    p.deathDate = input.date;
    p.deathReason = input.reason;
    d.appointments.forEach((a) => {
      if (a.patientId === p.id && a.start.slice(0, 10) >= input.date && (a.status === "planifie" || a.status === "confirme")) {
        a.status = "annule";
        a.queueStatus = "annule";
        a.cancelReason = "Décès de l'animal";
      }
    });
    audit(d, ctx, { module: "Patients", action: "Déclaration de décès", target: `${p.code} — ${p.name}`, oldValue: "Vivant", newValue: "Décédé", reason: input.reason, decision: "Confirmation explicite saisie" });
    return { message: "Statut vital mis à jour (trace enregistrée au journal). Rendez-vous futurs annulés." };
  });

export const setPatientAlerts: Service<{ patientId: string; allergies: string[]; alerts: string[] }> = (db, ctx, input) =>
  produce(db, (d) => {
    const p = must(d.patients.find((x) => x.id === input.patientId));
    p.allergies = input.allergies.filter(Boolean);
    p.alerts = input.alerts.filter(Boolean);
    audit(d, ctx, { module: "Patients", action: "Mise à jour des alertes cliniques", target: p.code });
    return { message: "Alertes cliniques mises à jour." };
  });

/** Photo du dossier patient (data URL — petits fichiers, démo locale). */
export const addPatientPhoto: Service<{ patientId: string; dataUrl: string; caption: string }> = (db, ctx, input) =>
  produce(db, (d) => {
    const p = must(d.patients.find((x) => x.id === input.patientId));
    if (!input.dataUrl.startsWith("data:image/")) fail("Image requise (PNG, JPG, WebP).");
    p.photos.unshift({ id: uid("ph"), dataUrl: input.dataUrl, caption: input.caption.trim(), date: ctx.now.slice(0, 10) });
    audit(d, ctx, { module: "Patients", action: "Ajout de photo", target: `${p.code} — ${p.name}` });
    return { message: "Photo ajoutée au dossier." };
  });

export const removePatientPhoto: Service<{ patientId: string; photoId: string }> = (db, ctx, { patientId, photoId }) =>
  produce(db, (d) => {
    const p = must(d.patients.find((x) => x.id === patientId));
    p.photos = p.photos.filter((x) => x.id !== photoId);
    audit(d, ctx, { module: "Patients", action: "Suppression de photo", target: `${p.code} — ${p.name}` });
    return { message: "Photo retirée du dossier." };
  });

/** Examen complémentaire consigné au dossier (radiographie, biologie…). */
export const addPatientExam: Service<{ patientId: string; type: Patient["exams"][number]["type"]; label: string; result: string; fileName?: string; consultationId?: string }> = (db, ctx, input) =>
  produce(db, (d) => {
    const p = must(d.patients.find((x) => x.id === input.patientId));
    if (!input.label.trim()) fail("Intitulé de l'examen requis.");
    p.exams.unshift({ id: uid("exm"), date: ctx.now.slice(0, 10), type: input.type, label: input.label.trim(), result: input.result.trim(), fileName: input.fileName, consultationId: input.consultationId, authorId: ctx.user.id });
    audit(d, ctx, { module: "Patients", action: "Examen complémentaire consigné", target: `${p.code} — ${p.name}`, newValue: input.type });
    return { message: "Examen consigné au dossier médical." };
  });
