import { uid } from "../format";
import { audit, fail, must, nextCode, produce, today, type Service } from "./core";

/* ---------------- Espace d'échange du personnel ---------------- */

/** Message interne (fil d'équipe, optionnellement lié à une mission). */
export const addStaffPost: Service<{ text: string; pinned?: boolean; missionId?: string }, string> = (db, ctx, input) =>
  produce(db, (d) => {
    if (!input.text.trim()) fail("Le message ne peut pas être vide.");
    if (input.missionId) must(d.missions.find((m) => m.id === input.missionId), "Mission introuvable.");
    const id = uid("post");
    d.staffPosts.unshift({ id, authorId: ctx.user.id, date: ctx.now, text: input.text.trim(), pinned: !!input.pinned, missionId: input.missionId, comments: [] });
    return { message: "Message publié dans l'espace équipe.", data: id };
  });

export const commentStaffPost: Service<{ postId: string; text: string }> = (db, ctx, { postId, text }) =>
  produce(db, (d) => {
    const p = must(d.staffPosts.find((x) => x.id === postId), "Message introuvable.");
    if (!text.trim()) fail("Commentaire vide.");
    p.comments.push({ id: uid("pc"), authorId: ctx.user.id, date: ctx.now, text: text.trim() });
    return { message: "Commentaire ajouté." };
  });

export const togglePinPost: Service<{ postId: string }> = (db, ctx, { postId }) =>
  produce(db, (d) => {
    const p = must(d.staffPosts.find((x) => x.id === postId), "Message introuvable.");
    p.pinned = !p.pinned;
    audit(d, ctx, { module: "Équipe", action: p.pinned ? "Message épinglé" : "Message désépinglé", target: p.id });
    return { message: p.pinned ? "Message épinglé." : "Message désépinglé." };
  });

/* ---------------- Réunions ---------------- */

export const createMeeting: Service<{ title: string; date: string; attendeeIds: string[]; report: string }, string> = (db, ctx, input) =>
  produce(db, (d) => {
    if (!input.title.trim()) fail("Titre de réunion requis.");
    if (!input.attendeeIds.length) fail("Sélectionnez au moins un participant.");
    const id = uid("mtg");
    const code = nextCode(d, "meeting", "REU", 3);
    d.meetings.unshift({ id, code, title: input.title.trim(), date: input.date || today(ctx), attendeeIds: input.attendeeIds, report: input.report.trim(), reportValidated: false, actionItems: [] });
    audit(d, ctx, { module: "Équipe", action: "Réunion enregistrée", target: code });
    return { message: `Réunion ${code} enregistrée — compte rendu à valider avant diffusion.`, data: id };
  });

export const updateMeetingReport: Service<{ id: string; report: string }> = (db, ctx, { id, report }) =>
  produce(db, (d) => {
    const m = must(d.meetings.find((x) => x.id === id));
    m.report = report;
    m.reportValidated = false;
    return { message: "Compte rendu mis à jour — à valider avant diffusion." };
  });

export const validateMeetingReport: Service<{ id: string }> = (db, ctx, { id }) =>
  produce(db, (d) => {
    const m = must(d.meetings.find((x) => x.id === id));
    if (!m.report.trim()) fail("Le compte rendu est vide.");
    m.reportValidated = true;
    audit(d, ctx, { module: "Équipe", action: "Validation de compte rendu", target: m.code, decision: `Validé par ${ctx.user.name}` });
    return { message: "Compte rendu validé." };
  });

export const addMeetingAction: Service<{ id: string; label: string; assigneeId?: string; dueDate?: string }> = (db, ctx, { id, label, assigneeId, dueDate }) =>
  produce(db, (d) => {
    const m = must(d.meetings.find((x) => x.id === id));
    if (!label.trim()) fail("Libellé d'action requis.");
    m.actionItems.push({ id: uid("mga"), label: label.trim(), assigneeId, dueDate, done: false });
    return { message: "Action ajoutée au suivi de la réunion." };
  });

export const toggleMeetingAction: Service<{ id: string; actionId: string }> = (db, ctx, { id, actionId }) =>
  produce(db, (d) => {
    const m = must(d.meetings.find((x) => x.id === id));
    const a = must(m.actionItems.find((x) => x.id === actionId), "Action introuvable.");
    a.done = !a.done;
    return { message: a.done ? "Action marquée réalisée." : "Action rouverte." };
  });
