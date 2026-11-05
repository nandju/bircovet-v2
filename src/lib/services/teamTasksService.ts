import { isHttpUrl } from "../protocols";
import { uid } from "../format";
import type { Task } from "../types";
import { audit, fail, must, notify, produce, type Service } from "./core";

export interface TeamTaskInput {
  title: string;
  description: string;
  assigneeId: string;
  priority: Task["priority"];
  dueDate: string;
  category: "equipe" | "document";
}

/** Confier une tâche (ou un document à produire) à un membre de l'équipe. */
export const assignTeamTask: Service<TeamTaskInput, string> = (db, ctx, input) =>
  produce(db, (d) => {
    if (!input.title.trim()) fail("Titre requis.");
    if (!input.assigneeId) fail("Choisissez la personne.");
    if (!input.dueDate) fail("Échéance requise.");
    const id = uid("tsk");
    d.tasks.unshift({ ...input, title: input.title.trim(), id, status: "a_faire", result: "", assignedById: ctx.user.id, history: [{ date: ctx.now, userId: ctx.user.id, action: "Tâche confiée" }] });
    if (input.assigneeId !== ctx.user.id) notify(d, ctx, { title: input.category === "document" ? "Document à produire" : "Nouvelle tâche", body: `${ctx.user.name} vous confie : ${input.title.trim()} (pour le ${input.dueDate.split("-").reverse().join("/")}).`, level: "info", link: "/equipe/taches", toUserIds: [input.assigneeId], push: true });
    return { message: "Tâche confiée.", data: id };
  });

/** La personne déclare la tâche faite ; un document doit être accompagné de son lien Drive. */
export const completeTeamTask: Service<{ id: string; note: string; driveUrl?: string }> = (db, ctx, { id, note, driveUrl }) =>
  produce(db, (d) => {
    const t = must(d.tasks.find((x) => x.id === id), "Tâche introuvable.");
    if (t.assigneeId !== ctx.user.id && ctx.user.roleId !== "dg") fail("Seule la personne chargée de la tâche (ou le DG) peut la déclarer faite.");
    if (t.category === "document" && !driveUrl?.trim()) fail("Collez le lien Drive du document.");
    if (driveUrl?.trim() && !isHttpUrl(driveUrl)) fail("Lien invalide : collez le lien de partage complet (https://drive.google.com/…).");
    t.status = "termine";
    t.result = note.trim() || "Fait";
    t.driveUrl = driveUrl?.trim() || t.driveUrl;
    const needsReview = !!t.assignedById && t.assignedById !== ctx.user.id;
    t.review = needsReview ? { status: "a_verifier" } : { status: "valide", byId: ctx.user.id, at: ctx.now };
    t.history.push({ date: ctx.now, userId: ctx.user.id, action: "Déclarée faite", note: [note.trim(), driveUrl?.trim()].filter(Boolean).join(" · ") || undefined });
    if (needsReview) notify(d, ctx, { title: "Tâche faite, à vérifier", body: `${ctx.user.name} a terminé : ${t.title}${t.driveUrl ? " (document joint)" : ""}.`, level: "info", link: "/equipe/taches", toUserIds: [t.assignedById!] });
    return { message: needsReview ? "Merci ! La tâche part en vérification." : "Tâche terminée." };
  });

/** Contrôle : valider ou faire reprendre. */
export const reviewTeamTask: Service<{ id: string; ok: boolean; note?: string }> = (db, ctx, { id, ok, note }) =>
  produce(db, (d) => {
    const t = must(d.tasks.find((x) => x.id === id), "Tâche introuvable.");
    if (t.assignedById !== ctx.user.id && ctx.user.roleId !== "dg") fail("Seule la personne qui a confié la tâche (ou le DG) la valide.");
    if (t.review?.status !== "a_verifier") fail("Cette tâche n'attend pas de vérification.");
    if (!ok && !note?.trim()) fail("Expliquez ce qu'il faut reprendre.");
    t.review = { status: ok ? "valide" : "a_reprendre", byId: ctx.user.id, at: ctx.now, note: note?.trim() || undefined };
    if (!ok) t.status = "en_cours";
    t.history.push({ date: ctx.now, userId: ctx.user.id, action: ok ? "Validée" : "À reprendre", note: note?.trim() || undefined });
    notify(d, ctx, { title: ok ? "Tâche validée" : "Tâche à reprendre", body: `${t.title}${note?.trim() ? ` — ${note.trim()}` : ""}`, level: ok ? "succes" : "alerte", link: "/equipe/taches", toUserIds: [t.assigneeId], push: !ok });
    audit(d, ctx, { module: "Équipe", action: ok ? "Tâche validée" : "Tâche à reprendre", target: t.title });
    return { message: ok ? "Tâche validée." : "Renvoyée pour reprise." };
  });
